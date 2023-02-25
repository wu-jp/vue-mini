# 代理 Set 和 Map

集合类型的响应式方案，集合类型包括Map/Set，以及WeakMap/WeakSet。Proxy代理集合类型和普通对象有很大的差别，因为集合类型数据的操作有很大的不同。

Set类型的原型属性和方法：

- size：返回集合中元素的数量
- add(value)：向集合中添加给定的值
- clear()：清空集合
- delete(value)：从集合中删除给定的值
- has(value)：判断集合中是否存在给定的值
- keys()：返回一个迭代器对象，可以用for...in循环，迭代器对象产生的值为集合中的元素值
- values()：对于Set集合类型来说，keys()和values()等价
- entries()：返回一个迭代器。迭代过程中为集合中的每一个元素产生一个数组值`[value,value]`。
- forEach(callback[,thisArg])：forEach函数会遍历集合中的所有元素，并对每一个元素调用callback函数，forEach 函数接收可选的第二个参数 thisArg，用于指定 callback 函数执行时的 this 值。

Map类型的原型属性和方法：

- size：返回 Map 数据中的键值对数量。
- clear()：清空 Map。
- delete(key)：删除指定 key 的键值对。
- has(key)：判断 Map 中是否存在指定 key 的键值对。
- get(key)：读取指定 key 对应的值。
- set(key, value)：为 Map 设置新的键值对。
- keys()：返回一个迭代器对象。迭代过程中会产生键值对的 key 值。
- values()：返回一个迭代器对象。迭代过程中会产生键值对的 value 值。
- entries()：返回一个迭代器对象。迭代过程中会产生由 [key, value] 组成的数组值。
- forEach(callback[, thisArg])：forEach 函数会遍历 Map 数据的所有键值对，并对每一个键值对调用 callback 函数。forEach 函数接收可选的第二个参数 thisArg，用于指定 callback 函数执行时的 this 值。

观察上面的列表可以发现，**两种数据类型的操作方法类似。最大的不同体现在，Set 类型使用 add(value) 方法添加元素，而 Map 类型使用 set(key, value) 方法设置键值对，并且 Map 类型可以使用 get(key) 方法读取相应的值**。

## 如何代理 Set 和 Map

当读取操作时，调用track函数触发响应联系；当设置操作发生时，调用trigger函数触发响应。

```js
const proxy = reactive(new Map(['key', 1]))

effect(() => {
  console.log(proxy.get('key')) // 读取键为key的值，应该收集响应联系
})

proxy.set('key', 2) // 设置键为key的值，应该触发响应
```

这段代码时我们最终需要实现的效果。

注意事项：

- size 是一个访问器属性，调用方法的时候，this需要指向原始对象 target
- delete等方法， this 也需要指向原始对象 target

```js
export function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      if (key === 'size') {
        return Reflect.get(target, key, target)
      }

      return target[key].bind(target)
      // 此处先忽略其他数据类型的get操作
    },
    // 其他拦截函数 ...
  })
}
```

```js
const p = reactive(new Set([1,2,3]))
console.log(p.size) // 3
```

## 建立响应关系

需要实现的目标：
```js
const p = creative(new Set([1,2,3]))
effect(() => {
  console.log(p.size)
})

p.add(1) 添加值1，应该触发响应
```

首先，在副作用函数内访问了 p.size 属性；接着，调用 p.add 函数向集合中添加数据。由于这个行为会间接改变集合的 size 属性值，所以我们期望副作用函数会重新执行。

需要在访问size属性时，调用track函数进行依赖追踪，然后调用add方法时，会间接修改size的属性值，需要调用trigger函数触发响应。

```js
let ITERATE_KEY = Symbol()

export function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      if (key === 'size') {
        track(target, ITERATE_KEY)
        return Reflect.get(target, key, target)
      }

      return target[key].bind(target)
      // 此处先忽略其他数据类型的get操作
    },
    // 其他拦截函数 ...
  })
}
```
这里响应联系需要建立在ITERATE_KEY和副作用函数之间，因为任何新增、删除操作都会影响size属性。

那么调用add方法时，怎么触发响应呢？我们需要实现一个自定义add方法:
```js
let ITERATE_KEY = Symbol()
const mutableInstrumentations = {
  add(key) {
    // this指向代理对象，通过raw 属性获取到原始数据对象
    const target = this.raw

    // 判断当前是否已经存在
    const hadKey = target.has(key)
    const res = target.add(key)
    // 只有不存在的情况下，才需要触发响应
    if(!hadKey) {
      trigger(target, key, 'ADD')
    }
    return res
  }
}

export function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      if( key === 'raw') return target

      if (key === 'size') {
        track(target, ITERATE_KEY)
        return Reflect.get(target, key, target)
      }

      // 返回自定义对象下的方法
      return mutableInstrumentations[key]

      // 此处先忽略其他数据类型的get操作
    },
    // 其他拦截函数 ...
  })
}
```

这样就实现了add方法触发响应，那么再来实现下delete操作：

```js
const mutableInstrumentations = {
  delete(key) {
    // this指向代理对象，通过raw 属性获取到原始数据对象
    const target = this.raw

    // 判断当前是否已经存在
    const hadKey = target.has(key)
    const res = target.delete(key)
    // 只有需要删除的元素存在的情况下，才需要触发响应
    if(hadKey) {
      trigger(target, key, 'DELETE')
    }
    return res
  }
}
```
delete 方法只有要删除的元素存在的情况下，才需要触发响应。这点和add方法相反。

## 避免污染原始对象

借助 Map 数据类型的 set 和 get 方法说一下什么是 "避免污染原始对象" 以及原理。

Map 数据类型拥有 get 和 set 这两个方法，当调用 get 方法读取数据时，需要调用 track 函数追踪依赖建立响应联系；当调用 set 方法设置数据时，需要调用 trigger 方法触发响应：

```js
const p = reactive(new Map([['key', 1]]))

effect(() => {
  console.log(p.get('key')) // 收集依赖
})

p.set('key', 2) // 触发响应
```

实现get方法：

```js
const mutableInstrumentations = {
  get(key) {
    // this指向代理对象，通过raw 属性获取到原始数据对象
    const target = this.raw

    // 判断当前是否已经存在
    const hadKey = target.has(key)
    track(target, key)

    // 如果存在，则返回结果，需要注意，如果得到的结果res任然时可以被代理的的数据，需要返回reactive包装后的响应式数据
    if(hadkey) {
      const res = target.get(key)
      return typeof res === 'object' ? reactive(res) : res
    }
  }
}
```

实现set方法：
```js
const mutableInstrumentations = {
  set(key, value) {
    const target = this.raw
    const had = target.has(key)

    // 获取旧值
    const oldValue = target.get(key)

    // 设置新值
    target.set(key, value)

    // 如果不存在，说明是ADD操作
    if (!had) {
      trigger(target, key, 'ADD')
    } else if (oldValue !== value || (oldValue === oldValue && value === value)) {
      // 如果存在，并且值变了，则是SET类型的操作
      trigger(target, key, 'SET')
    }
  }
}
```

我们需要判断设置的 key 是否存在，以便区分不同的操作类型。我们知道，对于 SET 类型和 ADD 类型的操作来说，它们最终触发的副作用函数是不同的。因为 ADD 类型的操作会对数据的 size 属性产生影响，所以任何依赖 size 属性的副作用函数都需要在 ADD 类型的操作发生时重新执行。

但是任然有问题，即set方法会污染原始数据，我们看下面的代码：
```js
const m = new Map()
const p1 = reactive(m)
const p2 = reactive(new Map())

pl.set('p2', p2)

effect(() => {
  console.log(m.get('p2').size)
})

m.get('p2').set('foo', 1)
```
p2是一个响应式对象，并被设置为p1的值。set方法是将value值设置到原始target上，如果value是响应式数据，就以位置原始对象上也是响应式数据。我们把**响应式数据设置到原始数据上的行为称为数据污染**。

所以需要在调用target.set函数前检查：只要发现即将要设置的值是响应式数据，那么就通过 raw 属性获取原始数据，再把原始数据设置到 target 上，如下面的代码所示：

```js
const mutableInstrumentations = {
  set(key, value) {
    const target = this.raw
    const had = target.has(key)

    // 获取旧值
    const oldValue = target.get(key)

    // 获取value的原始数据，如果value本身就是原始数据，就直接使用原始数据，否则调用raw拿到原始数据
    const rawValue = value.raw || value

    // 设置新值
    target.set(key, rawValue)

    // 如果不存在，说明是ADD操作
    if (!had) {
      trigger(target, key, 'ADD')
    } else if (oldValue !== value || (oldValue === oldValue && value === value)) {
      // 如果存在，并且值变了，则是SET类型的操作
      trigger(target, key, 'SET')
    }
  }
}
```

现在的实现已经不会造成数据污染了。不过我们一直使用raw属性来访问原始数据优点不太合适，因为如果用户自定义了raw属性，就会存在冲突，做好使用唯一的标识来访问原始数据，例如Symbol来代替。

## 处理 forEach

集合的forEach类似于数组的forEach方法：

```js
const m = new Map([
  [{key, 1}, {value: 1}]
])

effect(() => {
  m.forEach(function (value, key, m) {
    console.log(value) // { value: 1 }
    console.log(key) // { key: 1 }
  })
})
```

**遍历操作只与键值对的数量有关，因此任何修改Map对象键值对数量的操作都应该触发副作用函数重新执行**。例如delete和add方法。

所以当forEach函数调用时，我们应该让 ITERATE_KEY 和副作用函数建立响应联系：

```js
let ITERATE_KEY = Symbol()

const mutableInstrumentations = {
  forEach(callback, thisArg) {
    // wrap 方法用来把可代理的值转化为响应式数据
    const wrap = (val) => typeof val === 'object' ? reactive(val) : val
    // 拿到原始数据对象
    const target = this.raw
    // 与 ITERATE_KEY 建立响应关系
    track(target, ITERATE_KEY)
    // 通过原始数据调用forEach方法
    target.forEach((v, k) => {
      // 手动调用 callback 函数，如 wrap 包装 value 和 key 然后回传给callback，这样就实现了深响应式
      // 通过call方法调用callback，并传递thisArg
      // thisArg可以控制callback函数指向时的this
      callback.call(thisArg, wrap(v), wrap(k), this)
    })
  }
}
```

这样我们就自定义了forEach方法，但是trigger含需要修改一下：

```js
export function trigger(target, key, type, newVal, ITERATE_KEY = Symbol()) {
  const depsMap = bucket.get(target)
  if (!depsMap) return
  const effects = depsMap.get(key)
  const effectsToRun = new Set()

  effects && effects.forEach(effectFn => {
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn)
    }
  })

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
  else if (type === 'ADD' || type === 'DELETE' ||
    // 如果type类型为SET,并且目标对象时Map类型的数据，也需要触发那些与ITERATE_KEY有关联的副作用函数
    (type === 'SET' && Object.prototype.toString.call(target) === '[object Map]')
  ) {
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
我们增加了一个判断条件：如果操作的目标对象是 Map 类型的，则 SET 类型的操作也应该触发那些与 ITERATE_KEY 相关联的副作用函数重新执行。


## 迭代器方法

集合类型的迭代器方法：

- entries
- keys
- values

调用这几个方法会得到相应的迭代器，并且可以使用for...of循环迭代器。例如：

```js
const m = new Map([
  ['key1', 'value1'],
  ['key2', 'value2']
])

for(const [key, value] of m.entries()) {
  console.log(key, value)
}

// 输出：
// key1 value1
// key2 value2
```
另外，由于 Map 或 Set 类型本身部署了 Symbol.iterator 方法，因此它们可以使用 for...of 进行迭代

```js
for(const [key, value] of m) {
  console.log(key, value)
}

// 输出：
// key1 value1
// key2 value2
```
当然，我们也可以调用迭代器函数取得迭代器对象后，手动调用迭代器对象的 next 方法获取对应的值:

```js
const itr = m[Symbol.iterator]()
console.log(itr.next()) // {value: ['key1', 'value1'], done: false}
console.log(itr.next()) // {value: ['key2', 'value2'], done: false}
console.log(itr.next()) // {value: undefined, done: true}
```
实际上，`m[Symbol.iterator] `与 `m.entries` 是等价的：

```js
console.log(m[Symbol.iterator]() === m.entries) // true ✅
```

这就是为什么上例中使用 for...of 循环迭代 m.entries 和 m 会得到同样的结果。


实际上，当我们使用 for...of 循环迭代一个代理对象时，内部会试图从代理对象 p 上读取p[Symbol.iterator] 属性，这个操作会触发 get 拦截函数，所以我们仍然可以把 Symbol.iterator 方法的实现放到 mutableInstrumentations 中，如以下代码所示：

```js
let ITERATE_KEY = Symbol()

const mutableInstrumentations = {
  [Symbol.iterator](){
    const target = this.raw

    // 获取原始迭代器方法
    const itr = target[Symbol.iterator]()

    const wrap = (val) => typeof val === 'object' && val !== null ? reactive(val) : val

    // 调用 track 建立响应联系
    track(target, ITERATE_KEY)

    // 返回一个自定义的迭代器
    return {
      next() {
        const {value, done} = itr.next()
        return {
          // 如果 value 不是 undefined，则对其进行包装
          value: value ? [wrap(value[0]), wrap(value[1])] : value,
          done
        }
      }
    }
  }
}
```

由于迭代操作与集合中元素的数量有关，所以只要集合的 size 发生变化，就应该触发迭代操作重新执行。因此，我们在调用 track 函数时让 ITERATE_KEY 与副作用函数建立联系。

为了实现对 key 和 value 的包装，我们需要自定义实现的迭代器，在其中调用原始迭代器获取值 value 以及代表是否结束的 done。如果值 value 不为 undefined，则对其进行包装，最后返回包装后的代理对象，这样当使用 for...of 循环进行迭代时，得到的值就会是响应式数据了。

由于 p.entries 与 p[Symbol.iterator] 等价，所以我们可以使用同样的代码来实现对p.entries 函数的拦截，如以下代码所示：

```js
const mutableInstrumentations = {
  [Symbol.iterator]: iterationMethod,
  entries: iterationMethod
}

function iterationMethod() {
  const target = this.raw
  // 获取原始迭代器方法
  const itr = target[Symbol.iterator]()

  const wrap = (val) => typeof val === 'object' && val !== null ? reactive(val) : val

  // 调用 track 建立响应联系
  track(target, ITERATE_KEY)

  // 返回一个自定义的迭代器
  return {
    next() {
      const {value, done} = itr.next()
      return {
        // 如果 value 不是 undefined，则对其进行包装
        value: value ? [wrap(value[0]), wrap(value[1])] : value,
        done
      }
    }
  }
}
```
但当你尝试运行代码使用 for...of 进行迭代时，会得到一个错误：

```js
// TypeError: p.entries is not a function or its return value is not iterable
for (const [key, value] of p.entries()) {
  console.log(key, value)
}
```

错误的大意是 p.entries 的返回值不是一个可迭代对象。很显然，p.entries 函数的返回值是一个对象，该对象带有 next 方法，但不具有 Symbol.iterator 方法，因此它确实不是一个可迭代对象。这里是经常出错的地方，大家切勿把可迭代协议与迭代器协议搞混。**可迭代协议指的是一个对象实现了Symbol.iterator 方法，而迭代器协议指的是一个对象实现了 next 方法。但一个对象可以同时实现可迭代协议和迭代器协议**。

```js
function iterationMethod() {
  const target = this.raw
  // 获取原始迭代器方法
  const itr = target[Symbol.iterator]()

  const wrap = (val) => typeof val === 'object' && val !== null ? reactive(val) : val

  // 调用 track 建立响应联系
  track(target, ITERATE_KEY)

  // 返回一个自定义的迭代器
  return {
    next() {
      const {value, done} = itr.next()
      return {
        // 如果 value 不是 undefined，则对其进行包装
        value: value ? [wrap(value[0]), wrap(value[1])] : value,
        done
      }
    },
    // 实现可迭代协议
    [Symbol.iterator]() {
      return this
    }
  }
}
```

这样一切就正常工作了。

## values 与 keys 方法

values 方法的实现与 entries 方法类似，不同的是，当使用 for...of 迭代 values 时，得到的仅仅是Map 数据的值，而非键值对：

```js
for(const value of p.values()) {
  console.log(value)
}
```

values 方法的实现：

```js
const mutableInstrumentations = {
  [Symbol.iterator]: iterationMethod,
  entries: iterationMethod,
  values: valuesIterationMethod
}

function iterationMethod() { /* ... */ }

function valuesIterationMethod() {
  const target = this.raw

  const itr = target.values()

  const wrap = (val) => typeof val === 'object' && val !== null ? reactive(val) : val
  track(target, ITERATE_KEY)

  return {
    next() {
      const {value, done} = itr.next()
      return {
        // value 是值，而非键值对，所以只需要包装 value 即可
        value: wrap(value),
        done
      }
    },
    // 实现可迭代协议
    [Symbol.iterator]() {
      return this
    }
  }
}
```

keys 方法与 values 方法非常类似，不同点在于，前者处理的是键而非值。因此，我们只需要修改valuesIterationMethod 方法中的一行代码，即可实现对 keys 方法的代理。把下面这句代码：

```js
const itr = target.values()
// ==> 变成
const itr = target.keys()

```

我们对 Map 类型的数据进行了特殊处理。前文提到，即使操作类型为 SET，也会触发那些与 ITERATE_KEY 相关联的副作用函数重新执行。

这对于 values 或 entries 等方法来说是必需的，但对于 keys 方法来说则没有必要，因为 keys 方法只关心 Map 类型数据的键的变化，而不关心值的变化。

```js
const MAP_KEY_ITERATE_KEY = Symbol()

const mutableInstrumentations = {
  [Symbol.iterator]: iterationMethod,
  entries: iterationMethod,
  values: valuesIterationMethod,
  keys: keysIterationMethod,
}

function iterationMethod() { /* ... */ }

function valuesIterationMethod() { /* ... */ }
function keysIterationMethod() {
  const target = this.raw

  const itr = target.keys()

  const wrap = (val) => typeof val === 'object' && val !== null ? reactive(val) : val

  track(target, MAP_KEY_ITERATE_KEY)

  return {
    next() {
      const {value, done} = itr.next()
      return {
        // value 是值，而非键值对，所以只需要包装 value 即可
        value: wrap(value),
        done
      }
    },
    // 实现可迭代协议
    [Symbol.iterator]() {
      return this
    }
  }
}
```

当调用 track 函数追踪依赖时，我们使用 MAP_KEY_ITERATE_KEY 代替了ITERATE_KEY。其中 MAP_KEY_ITERATE_KEY 与 ITERATE_KEY 类似，是一个新的 Symbol 类型，用来作为抽象的键。这样就实现了依赖收集的分离，即 values 和 entries 等方法仍然依赖ITERATE_KEY，而 keys 方法则依赖 MAP_KEY_ITERATE_KEY。当 SET 类型的操作只会触发与ITERATE_KEY 相关联的副作用函数重新执行时，自然就会忽略那些与 MAP_KEY_ITERATE_KEY 相关联的副作用函数。但当 ADD 和 DELETE 类型的操作发生时，除了触发与 ITERATE_KEY 相关联的副作用函数重新执行之外，还需要触发与 MAP_KEY_ITERATE_KEY 相关联的副作用函数重新执行，因此我们需要修改 trigger 函数的代码，如下所示：

```js
export function trigger(target, key, type, newVal, MAP_KEY_ITERATE_KEY) {
  const depsMap = bucket.get(target)
  if (!depsMap) return
  const effects = depsMap.get(key)
  const effectsToRun = new Set()
  // 省略其代码

  if (type === 'ADD' || type === 'DELETE' ||
    // 如果目标对象时Map类型的数据，需要触发那些与 MAP_KEY_ITERATE_KEY 有关联的副作用函数
    (Object.prototype.toString.call(target) === '[object Map]')
  ) {
    const iterateEffects = depsMap.get(MAP_KEY_ITERATE_KEY)
    iterateEffects && iterateEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  }


  // 省略其他代码
}
```
