# 原始值的响应式方案

原始值指的是：Boolean、Number、BigInt、Symbol、undefined 和 null 等类型的值。

Javascript中Proxy无法提供对原始值的代理，因此需要将原始值进程一层包装。

## 引入 ref 的概念

使用一个非原始值去“包裹”原始值，例如使用一个对象包裹原始值：

```js
const wrapper = {
  value: 'vue'
}

const name = reactive(wrapper)
name.value
name.value = 'vue3' // 修改值可以触发响应式
```

这样会导致两个问题：

- 用户为了创建一个响应式的原始值，不得不顺带创建一个包裹对象
- 包裹对象由用户定义，而这意味着不规范。用户可以随意命名，例如wrapper.value、wrapper.val 都是可以的

我们封装一个ref函数进行包裹：

```js
function ref(val) {
  const wrapper = {
    value: val
  }

  // 在 wrapper 对象上定义一个不可枚举的属性 __v_isRef，并设置值 true
  Object.definedProperty(wrapper, '__v_isRef', {
    value: true
  })

  // 将包裹的对象变成响应数据
  return reactive(wrapper)
}
```

我们使用 Object.defineProperty 为包裹对象 wrapper 定义了一个不可枚举且不可写的属性 __v_isRef，它的值为 true，代表这个对象是一个 ref，而非普通对象。这样我们就可以通过检查 __v_isRef 属性来判断一个数据是否是ref 了。

## 响应丢失问题

看下面的例子：

```js
const obj = reactive({foo: 1, bar: 2})

const newObj = {
  ...obj
}

effect(()=> {
  console.log(newObj.foo)
})

obj.foo = 100
```

如上面的代码所示，首先创建一个响应式的数据对象 obj，然后使用展开运算符得到一个新的对象 newObj，它是一个普通对象，不具有响应能力。这里的关键点在于，副作用函数内访问的是普通对象 newObj，它没有任何响应能力，所以当我们尝试修改 obj.foo 的值时，不会触发副作用函数重新执行。

我们修改上面的代码:

```js
const obj = reactive({foo: 1, bar: 2})

const newObj = {
  foo: {
    get value() {
      return obj.foo
    }
  },
  bar: {
    get value() {
      return obj.bar
    }
  }
}

effect(()=> {
  console.log(newObj.foo.value)
})

obj.foo = 100
```
在 newObj 对象下，具有与 obj 对象同名的属性，而且每个属性的值都是一个对象，该对象有一个访问器属性 value，当读取 value 的值时，最终读取的是响应式数据 obj 下的同名属性值。也就是说，当在副作用函数内读取 newObj.foo 时，等价于间接读取了 obj.foo 的值。这样响应式数据自然能够与副作用函数建立响应联系。于是，当我们尝试修改 obj.foo 的值时，能够触发副作用函数重新执行。

我们来封装一个函数：基于响应式对象的一个属性，创建一个对应的ref。并且保持创建的ref和源属性保持一致：改变源属性的值将更新 ref 的值，反之亦然。

```js
function toRef(obj, key) {
  const wrapper = {
    get value() {
      return obj[key]
    },
    set value(val) {
      obj[key] = val
    }
  }

  // 在 wrapper 对象上定义一个不可枚举的属性 __v_isRef，并设置值 true
  Object.definedProperty(wrapper, '__v_isRef', {
    value: true
  })

  return wrapper
}
```

toRef 函数接收两个参数，第一个参数 obj 是一个响应式数据，第二个参数是obj 对象的一个键。

```js
const obj = reactive({foo: 1, bar: 2})

const fooRef = toRef(obj, 'foo')

effect(()=> {
  console.log(fooRef.value)
})

obj.foo = 100 // 改变源数据，会触发响应
```

但如果响应式数据 obj 的键非常多，我们还是要花费很大力气来做这一层转换。为此，我们可以封装 toRefs 函数，来批量地完成转换：

```js
function toRefs(obj) {
  const ret = {}
  for(const key in obj) {
    ret[key] = toRef(obj, key)
  }

  return ret
}
```

toRefs：将一个响应式对象转换为一个普通对象，这个普通对象的每个属性都是指向源对象相应属性的 ref。每个单独的 ref 都是使用 `toRef()` 创建的。

```js
const obj = reactive({foo: 1, bar: 2})

const objAsRef = toRefs(obj)

effect(()=> {
  console.log(objAsRef.foo.value)
})

obj.foo = 100 // 改变源数据，会触发响应
```

当从组合式函数中返回响应式对象时，toRefs 相当有用。使用它，消费者组件可以解构/展开返回的对象而不会失去响应性：

```js
function useFeatureX() {
  const state = reactive({
    foo: 1,
    bar: 2
  })

  // ...基于状态的操作逻辑

  // 在返回时都转为 ref
  return toRefs(state)
}

// 可以解构而不会失去响应性
const { foo, bar } = useFeatureX()
```

## 自动脱 ref

自动脱ref指的是，访问属性时每次需要通过value访问值，增加了用户的心智负担。在vue3中，组件中的 setup 函数所返回的数据会自动脱ref，所以在模板中不需要通过`.value`来访问和设置属性

我们来实现这个函数：

```js
function proxyRefs(target) {
  return new Proxy(target, {
    get(terget, key, receiver) {
      const value = Reflect.get(target, value, receiver)
      return value.__v_isRef ? value.value : value
    },
    set(target, value, newValue, receiver) {
      const oldValue = tareget[key]
      // 如果值是一个 Ref, 则设置其对应的 value 属性值
      if(oldValue.__v_isRef) {
        oldValue.value = newValue
        return true
      }
      return Reflect.set(target, key, newValue, receiver)
    }
  })
}
```

实际上，自动脱ref不仅存在于模板中，reactive 函数也有自动脱 ref 的能力，如以下代码所示：

```js
const count = ref(0)
const obj = reactive({count})

obj.count // 0
```

可以看到，obj.count 本应该是一个 ref，但由于自动脱 ref 能力的存在，使得我们无须通过 value 属性即可读取 ref 的值。这么设计旨在减轻用户的心智负担，因为在大部分情况下，用户并不知道一个值到底是不是 ref。有了自动脱 ref 的能力后，用户在模板中使用响应式数据时，将不再需要关心哪些是ref，哪些不是 ref。
