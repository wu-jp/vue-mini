# 代理数组

数组元素或属性的读取操作：
- 通过索引访问数组元素值：`arr[0]`
- 访问数组的长度：`arr.length`
- 把数组作为对象，使用 `for...in` 循环遍历
- 使用 `for...of` 迭代遍历数组
- 数组的原型方法，如 `concat、join、every、some、find、findIndex、includes` 等，以及其他所有不改变原数组的原型方法

数组元素或属性的设置操作：
- 通过索引修改数组元素值：`arr[1] = 1`
- 修改数组的长度：`arr.length = 0`
- 数组的栈方法：`push、pop、shift、unshift`
- 修改原数组的原型方法：`splice、fill、sort` 等

除了通过数组索引修改数组元素值这种基本操作之外，数组本身还有很多会修改原数组的原型方法。调用这些方法也属于对数组的操作，有些方法的操作语义是“读取”，而有些方法的操作语义是“设置”。因此，当这些操作发生时，也应该正确地建立响应联系或触发响应。

## 数组的索引和 length

当修改 length 属性值时，只有那些索引值大于或等于新的 length 属性值的元素才需要触发响应。

```js
export function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    set(target, key, newVal, receiver) {
      // target 为数组的情况下 key === 'length' ，newVal为数组的新长度
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`)
        return true
      }

      const oldVal = target[key]

      // 如果属性不存在，说明是在添加新属性，否则是设置已有属性
      const type = Array.isArray(target)
        // 如果代理目标是数组，则检测被设置的索引值是否小于数组长度
        // 如果是，则视为 SET 操作, 否则为 ADD 操作
        ? newVal < target.length ? 'SET' : 'ADD'
        : Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD'

      const res = Reflect.set(target, key, newVal, receiver)
      if (target === receiver.raw) {
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          // 新增第四个参数，即触发响应的新增
          trigger(target, key, type, newVal)
        }
      }
      return res
    },
    // 其他拦截函数 ...
  })
}
```

```js
export function trigger(target, key, type, newVal) {
  const depsMap = bucket.get(target)
  if (!depsMap) return
  const effects = depsMap.get(key)
  const effectsToRun = new Set()

  effects && effects.forEach(effectFn => {
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn)
    }
  })

  // 如果操作的目标对象是数组，并修改了数组长度
  if (Array.isArray(target) && key === 'length') {
    depsMap.forEach((effects, key) => {
      if (key >= newVal) {
        effects.forEach(effectFn => {
          if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn)
          }
        })
      }
    })
  }
  // 非数组；只有当操作为 ‘ADD’ 或者 ‘DELETE’ 时，才触发 ITERATE_KEY 相关的依赖重新执行
  else if (type === 'ADD' || type === 'DELETE') {
    const iterateEffects = depsMap.get(ITERATE_KEY)
    iterateEffects && iterateEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  }

  effectsToRun.forEach(effectFn => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn)
    } else {
      effectFn()
    }
  })
}
```

## 遍历数组

### for...in 循环
当数组的长度被修改，那么for...in 循环对数组的遍历结果就会发生变化。所以我们可以在 ownKeys 拦截函数内，判断当前操作的目标 target 是否时数组，如果是，则使用length 作为key 去建立响应联系：

```js
function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    // 省略其他拦截函数
    ownKeys(target) {
      // 如果操作的目标 target 是数组，则使用 length 属性作为 key 并建立响应联系
      track(target, Array.isArray(target) ? 'length' : ITERATE_KEY)
      return Reflect.ownKeys(target)
    }
  })
}

```

### for...of 迭代

迭代数组时，只需要在副作用函数与数组的长度和索引之间建立响应关系，就能够实现响应式的for...of迭代，所以不需要修改任何的代码就可以正常的工作。

无论是使用 for...of 循环，还是调用 values 等方法，它们都会读取数组的Symbol.iterator 属性。该属性是一个 symbol 值，为了避免发生意外的错误，以及性能上的考虑，我们不应该在副作用函数与 Symbol.iterator 这类 symbol 值之间建立响应联系，因此需要修改 get 拦截函数：

```js
function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    // 省略其他拦截函数
    get(target, key, receiver) {

      if (key === 'raw') {
        return target
      }

      // 只有非只读的，才需要建立响应联系 && 如果key的类型为symbol，则不进行追踪
      if (!isReadonly && typeof key !== 'symbol') {
        track(target, key)
      }

      const res = Reflect.get(target, key, receiver)
      if (isShallow) {
        return res
      }

      if (typeof res === 'object' && res !== null) {
        return isReadonly ? readonly(res) : reactive(res)
      }

      return res
    },
  })
}
```

## 数组的查找方法

### 问题一

```js
// 处理深对象
if (typeof res === 'object' && res !== null) {
  // 如果数据为只读，则调用 readonly 对值进行包装
  return isReadonly ? readonly(res) : reactive(res)
}
```

通过代理对象来访问元素值时，如果值仍然是可以被代理的，那么得到的值就是新的代理对象而非原始对象。

```js
const obj = {}
const arr = reactive([obj])
console.log(arr.includes(arr[0])) // false ❌
```

看上面这段代码，预期值应该是 true ,但是结果却是 false, 为什么呢？arr.includes去访问数组元素时，返回的是一个代理对象，而在读取 arr[0] 时得到的也是一个代理对象 (`reactive(res)`) 。两个代理对象不同所以导致返回 false。

而要想解决这个问题，就要避免重复代理：
```js
// 定义一个 Map 实例，存储原始对象到代理对象的映射
const reactiveMap = new Map()

export function reactive(obj) {
  // 优先通过原始对象obj寻找之前创建的代理对象，如果找到了，直接返回已有的代理对象
  const existionProxy = reactiveMap.get(obj)
  if (existionProxy) return existionProxy

  // 否则，创建新的代理对象
  const proxy = createReactive(obj)
  // 存储到 Map 中，以避免重复创建
  reactiveMap.set(obj, proxy)

  return proxy
}
```

再执行这段代码就符合预期了：

```js
const obj = {}
const arr = reactive([obj])
console.log(arr.includes(arr[0])) // true ✅
```

问题二

```js
const obj = {}
const arr = reactive([obj])
console.log(arr.includes(obj)) // false ❌
```

我们直接把原始对象作为参数传递给 includes 方法，自己明明把 obj 作为数组的第一个元素了，为什么在数组中却仍然找不到 obj 对象呢？

因为 includes 内部的 this 指向的是代理对象 arr，并且在获取数组元素时得到的值也是代理对象，所以拿原始对象 obj 去查找肯定找不到，所以返回 false 。

因此需要重新类似数组查找方法：

```js
export function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {

      // 允许代理对象通过 raw 属性，访问原始对象
      if (key === 'raw') {
        return target
      }

      // 如果操作的目标是数组，并且 key 存在于 arrayInstrumentations 上，
      // 那么返回定义在 arrayInstrumentations 上的值
      if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, receiver)
      }

      if (!isReadonly && typeof key !== 'symbol') {
        track(target, key)
      }

      const res = Reflect.get(target, key, receiver)

      if (isShallow) {
        return res
      }

      if (typeof res === 'object' && res !== null) {
        return isReadonly ? readonly(res) : reactive(res)
      }

      return res
    },
    // 其他拦截函数 ...
  })
}
```

```js
// 重写数组方法，解决在代理对象中查找原始对象异常的问题
const arrayInstrumentations = {}

let methods = ['includes', 'indexOf', 'lastIndexOf']

methods.forEach(method => {
  const originMethod = Array.prototype[method]

  arrayInstrumentations[method] = function (...args) {
    // this 是代理对象，先在代理对象中查找，将结果存储到res
    let res = originMethod.apply(this, args)

    // 如果在代理对象中没有找到，通过 this.raw 拿到原始数组，再进行查找并更新res
    if (res === false || res === -1) {
      res = originMethod.apply(this.raw, args)
    }
    // 返回最终效果
    return res
  }
})
```

在执行下面这段代码，就符合预期结果：

```js
const obj = {}
const arr = reactive([obj])
console.log(arr.includes(obj)) // true ✅
```

## 隐式修改数组长度的原型方法

通过历史栈的方式修改数组的方法，例如push/pop/shift/unshift，除此之外，splice 方法也会修改数组的长度。

```js
const arr = reactive([])

// 第一个副作用函数
effect(() => {
  arr.push(1)
})

// 第二个副作用函数
effect(() => {
  arr.push(1)
})
```

我们尝试执行这段代码，发现会得到栈溢出的错误（Maximum call stack size exceeded）。为什么会这样呢？我们尝试分析下：

- 第一个副作用函数执行。在该函数内，先调用 arr.push 方法向数组中添加了一个元素。我们知道，调用数组的 push 方法会间接读取数组的 length 属性。所以，当第一个副作用函数执行完毕后，会与 length 属性建立响应联系
- 接着，第二个副作用函数执行也会与 length 属性建立响应联系。但不要忘记，调用arr.push 方法还会间接设置 length 属性的值
- 第二个函数内设置了数组的 length 属性值。于是，响应系统尝试把与length 属性相关联的副作用函数全部取出并执行，其中就包括第一个副作用函数。问题就出在这里，可以发现，第二个副作用函数还未执行完毕，就要再次执行第一个副作用函数了
- 第一个副作用函数再次执行。同样，这会间接设置数组的 length 属性。于是，响应系统又要尝试把所有与 length 属性相关联的副作用函数取出并执行，其中就包含第二个副作用函数
- 如此循环，最终导致栈溢出

那么问题如何解决呢？首先数组的push方法定义的是修改操作，而不是读取操作。所以我们想办法避免此类操作方法导致 length 属性和副作用函数建立联系就可以了：

```js
// 一个标记变量，代表是否进行追踪，默认为true，即允许追踪
let isShouldTrack = true

let changeLengthMethods = ['push', 'pop', 'shift', 'unshift', 'splice']
changeLengthMethods.forEach(method => {
  const originMethod = Array.prototype[method]
  arrayInstrumentations[method] = function (...args) {
    // 在调用原始方法前，先禁止追踪
    isShouldTrack = false

    // push 方法的默认行为
    let res = originMethod.apply(this, args)
    // 在调用原始方法后，恢复追踪
    isShouldTrack = true
    // 返回最终效果
    return res
  }
})
```

```js
export function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {

      // 允许代理对象通过 raw 属性，访问原始对象
      if (key === 'raw') {
        return target
      }

      // 如果操作的目标是数组，并且 key 存在于 arrayInstrumentations 上，
      // 那么返回定义在 arrayInstrumentations 上的值
      if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, receiver)
      }

      // 只有非只读的，才需要建立响应联系 && 如果key的类型为symbol，则不进行追踪 && 调用修改数组长度方式时
      if (!isReadonly && typeof key !== 'symbol' && isShouldTrack) {
        track(target, key)
      }

      const res = Reflect.get(target, key, receiver)

      if (isShallow) {
        return res
      }

      if (typeof res === 'object' && res !== null) {
        return isReadonly ? readonly(res) : reactive(res)
      }

      return res
    },
    // 其他拦截函数 ...
  })
}
```

arr.push(1) ——>  (读取 key => push) ——>  (读取 key => length) ——> (设置 key => 下标的值) ——> (设置 key => length)
