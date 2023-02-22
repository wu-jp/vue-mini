# 响应式系统的作用与实现

## 响应式数据和副作用函数

| 副作用函数指的是会产生副作用的函数😓😓😓

```js
function effect() {
  document.body.innerText = 'hello vue3'
}
```

当effect函数执行时，会修改body的文本内容，但时除了effect函数之外的任何函数都可读取到或设置body的文本。也就是说effect函数的执行会直接或者间接的影响到其他函数的执行，这时我们就可以说effect函数产生了副作用。

当修改一个全局的变量时，其实也是一个副作用，例如：
```js
let val = 1
function effect() {
  val = 2 // 修改全局变量，产生副作用
}
```

那什么又是响应式数据呢，假设在一个副作用函数中读取了某一个对象的属性：
```js
const obj = {
  text: 'hello world'
}

function effect () {
  // effect 函数的执行，会读取 obj.text
  document.body.innerText = obj.text
}
```

如上面的代码所示，副作用函数 effect 会设置 body 元素的innerText 属性，其值为 obj.text，当 obj.text 的值发生变化时，我们希望副作用函数 effect 会重新执行：

```js
obj.text = 'hello vue3'
```

在上面这行代码执行后，我们希望副作用函数能自动重新执行，如果能实现，那么对象obj就是响应式对象。但是目前显然是做不到这点的。

## 响应式数据的基本实现

接着上文思考，如何才能让 obj 变成响应式数据呢？通过观察我们能发现两点线索：
- 当副作用函数 effect 执行时，会触发字段 obj.text 的读取操作；
- 当修改 obj.text 的值时，会触发字段 obj.text 的设置操作。

如果我们能拦截一个对象的读取和设置操作，事情就变得简单了，当读取字段 obj.text 时，我们可以把副作用函数 effect 存储到一个“桶”里，

[插图]图4-1　将副作用函数存储到“桶”中

接着，当设置 obj.text 时，再把副作用函数 effect 从“桶”里取出并执行即可

[插图]图4-2　把副作用函数从“桶”内取出并执行

我们如何才能拦截一个对象属性的读取和设置操作。在 ES2015 之前，只能通过Object.defineProperty 函数实现，这也是 Vue.js 2 所采用的方式。在 ES2015+ 中，我们可以使用代理对象 Proxy 来实现，这也是 Vue.js 3 所采用的方式。

接下来我们就根据如上思路，采用 Proxy 来实现：

```js
// 存储副作用函数的桶
const bucket = new Set()

// 原始数据
const data = { text: 'hello world' }

// 对原始数据的代理
const obj = new Proxy(data, {
  // 拦截读取操作
  get(target, key) {
    // 将副作用函数effect 添加到存储副作用函数的桶中
    bucket.add(effect)

    // 返回读取的属性值
    return target[key]
  },
  // 拦截设置操作
  set(target, key, newVal) {
    // 设置新的属性值
    target[key] = newVal
    // 把副作用函数从桶中取出并执行
    bucket.forEach(fn => fn())
    // 返回 true 代表设置操作成功
    return true
  }
})
```

这样我们就实现了一个简单的响应式数据，可以测试上面这段代码：

```js
// 副作用函数
function effect() {
  document.body.innerText = obj.text
}
// 执行副作用函数，触发读取操作
effect()
// 1秒后 触发修改操作
setTimeout(() => {
  obj.text = 'hello vue3'
}, 1000)
```

现在依然存在很对缺陷，例如副作用函数名硬编码等

## 设计一个完善的响应系统

从上一部分可以看出，一个响应式系统的流程如下：
- 当读取操作发生时，将副作用函数收集到“桶”中；
- 当设置操作发生时，从“桶”中取出副作用函数并执行。

用一个全局变量存储被注册的副作用函数：
```js
// 用一个全局变量存储被注册的副作用函数
let activeEffect

// effect 函数用于注册副作用函数，将副作用函数 fn 赋值给 activeEffect
function effect(fn) {
  activeEffect = fn
  // 执行副作用函数
  fn()
}
```

现在调用整个注册函数
```js
effect(() => {
  document.body.innerHTML = obj.text
})
```

当附着于函数effect执行时，会把匿名函数fn 赋值给全局变量 activeEffect。接着执行被注册的匿名函数fn，这样就会触发响应式数据obj.text 的读取操作，进而触发代理对象Proxy的拦截函数：

```js
const obj = new Proxy(data, {
  get(target, key) {
    // 将 activeEffect 添加到存储副作用函数的桶中
    if (activeEffect) {
      bucket.add(activeEffect)
    }
    return target[key]
  },
  set(target, key, newVal) {
    target[key] = newVal
    bucket.forEach(fn => fn())
    return true
  }
})
```

现在我们就可以把匿名函数存储到activeEffect桶中，现在就不再依赖副作用函数的名字了。

但是我们给响应式数据设置一个新的数据时：
```js
effect(() => {
  console.log('effect run')
  document.body.innerHTML = obj.text
})

setTimeout(() => {
  obj.notExist = 'hello vue3'
}, 1000)

```

'effect run' 会被打印两次，这时为什么呢？

在匿名函数中并没有读取obj.noExist属性的值，obj.noExist 并没有和副作用函数建立任何响应联系，但是还是会触发 set 拦截函数。 我们不希望在没有联系时还会触发副作用函数。那么我们要如何解决这个问题呢？

我们需要重新设计“桶”的数据结构。

接下来我们尝试用代码来实现这个新的“桶”。首先，需要使用 WeakMap 代替 Set 作为桶的数据结构：

```js
// 存储副作用函数的桶
const bucket = new WeakMap()
```

然后修改 get/set 拦截器的代码：

```js
const data = {
  text: 'hello world'
}
// 存储副作用函数的桶
const bucket = new WeakMap()

// 用一个全局变量存储被注册的副作用函数
let activeEffect

const obj = new Proxy(data, {
  get(target, key) {
    // 没有 activeEffect ，直接 return 读取值
    if (!activeEffect) return target[key]

    // 根据 target 从桶中取得 depsMap，它也是一个Map 类型：key --> effect
    let depsMap = bucket.get(target)

    // 如果不存在 depsMap，那么就新建一个 Map 并和 target 关联
    if (!depsMap) {
      bucket.set(target, (depsMap = new Map()))
    }

    // 再根据 key 从 depsMap 中取得 deps，它是一个 Set 类型，里面存储着所有和当前key 相关联的副作用函数：effects
    let deps = depsMap.get(key)

    // 如果deps 不存在，同样新建一个 Set 并和 key 关联
    if (!deps) {
      depsMap.set(key, (deps = new Set()))
    }
    // 最后将当前激活的副作用函数添加到桶里
    deps.add(activeEffect)

    // 返回读取值
    return target[key]
  },
  set(target, key, newVal) {
    // 设置新的值
    target[key] = newVal

    // 根据target 从桶中取出 depsMap，它是 key --> effects
    const depsMap = bucket.get(target)
    if (!depsMap) return

    // 根据key拿到所有的副作用函数
    const effects = depsMap.get(key)
    // 执行副作用函数
    effects && effects.forEach(fn => fn())
  }
})
```

从这段代码可以看出构建数据结构的方式，我们分别使用了 WeakMap、Map 和 Set：
- WeakMap 由 target --> Map 构成；
- Map 由 key --> Set 构成。

其中 WeakMap 的键是原始对象 target，WeakMap 的值是一个 Map 实例，而 Map 的键是原始对象 target 的 key，Map 的值是一个由副作用函数组成的 Set。

![./1.png](桶的机构图)

如果不清楚 WeakMap 和 Map 数据结构的区别需要自行去了解下，主要是利用：WeakMap 的键名所指向的的对象，不计入垃圾回收机制。（ WeakMap 的 key 时弱引用，它不影响垃圾回收机制的工作 ）

最后我们可以把 get 拦截操作单独提取出来，封装到一个track函数中，函数的名字主要表达**追踪**的含义；同样可以将**触发**的操作也单独封装到 trigger 函数中：

```js

const data = {
  text: 'hello world'
}

const bucket = new WeakMap()

let activeEffect

const obj = new Proxy(data, {
  get(target, key) {
    track(target, key)
    return target[key]
  },
  set(target, key, newVal) {
    target[key] = newVal
    trigger(target, key)
  }
})

// 在get拦截函数中内调用track函数追踪变化
function track(target, key) {
  if (!activeEffect) return target[key]

  let depsMap = bucket.get(target)
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()))
  }

  let deps = depsMap.get(key)
  if (!deps) {
    depsMap.set(key, (deps = new Set()))
  }

  deps.add(activeEffect)
}

// 在set 拦截函数内调用 trigger 函数触发变化
function trigger(target, key) {
  const depsMap = bucket.get(target)

  if (!depsMap) return

  const effects = depsMap.get(key)

  effects && effects.forEach(fn => fn())
}

// effect 函数用于注册副作用函数，将副作用函数 fn 赋值给 activeEffect
function effect(fn) {
  activeEffect = fn
  // 执行副作用函数
  fn()
}

effect(() => {
  console.log('effect run')
  document.body.innerHTML = obj.text
})

setTimeout(() => {
  obj.notExist = 'hello vue3'
}, 1000)

```

## 分支切换与 cleanup

首先，我们需要明确分支切换的定义，如下面的代码所示：

```js
const data = {
  ok: true,
  text: 'hello world'
}

const obj = new Proxy(data, {/* ... */})

effect(function effectFn(){
  document.body.innerText = obj.ok ? obj.text : 'not'
})
```

在 effectFn 函数内部存在一个三元表达式，根据字段 obj.ok 值的不同会执行不同的代码分支。当字段 obj.ok 的值发生变化时，代码执行的分支会跟着变化，这就是所谓的分支切换。

当 设置obj.ok 为 true 时切换分支，导致产生遗留的副作用函数（不会再读取obj.text，导致第一次读取obj.text时收集的副作用函数被遗留）。

想要解决这个问题的思路也很简单，每次副作用函数执行时，我们可以先把它从所有与之有关的依赖集合中删除。

当副作用函数执行完毕后，会重新建立联系，但在新的联系中不会包含遗留的副作用函数，即图 4-5所描述的那样。所以，如果我们能做到每次副作用函数执行前，将其从相关联的依赖集合中移除，那么问题就迎刃而解了。

重新设计副作用函数，在 effect 内部我们定义了新的 effectFn 函数，并为其添加了 effectFn.deps 属性，该属性是一个数组，用来存储所有包含当前副作用函数的依赖集合：

```js
function effect(fn) {
  const effectFn = () => {
    // 当effectFn 执行时，将其设置为当前激活的副作用函数
    activeEffect = effectFn
    fn()
  }
  effectFn.deps = []
  effectFn()
}
```

那么 effectFn.deps 数组中的依赖集合是如何收集的呢？其实是在 track 函数中：

```js
function track(target, key) {
  if (!activeEffect) return target[key]
  let depsMap = bucket.get(target)

  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()))
  }

  let deps = depsMap.get(key)
  if (!deps) {
    depsMap.set(key, (deps = new Set()))
  }

  deps.add(activeEffect)
  // deps 是一个与当前副作用函数关联的依赖集合，将其添加到 activeEffect.deps 数组中
  activeEffect.deps.push(deps)
}
```

有了这个联系后，我们就可以在每次副作用函数执行时，根据 effectFn.deps 获取所有相关联的依赖集合，进而将副作用函数从依赖集合中移除：

```js
// 用一个全局变量存储被注册的副作用函数
let activeEffect

function effect(fn) {
  const effectFn = () => {
    // 调用 cleanup 函数完成清理工作
    cleanup(effectFn)
    // 当effectFn 执行时，将其设置为当前激活的副作用函数
    activeEffect = effectFn
    fn()
  }
  effectFn.deps = []
  effectFn()
}
```

实现cleanup函数：
```js
function cleanup(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    // deps 是依赖集合
    const deps = effectFn.deps[i]
    // 将 effectFn 从依赖集合中删除
    deps.delete(effectFn)
  }
  // 最后需要重置 effectFn.deps 数组
  effectFn.deps.length = 0
}
```

cleanup 函数接收副作用函数作为参数，遍历副作用函数的 effectFn.deps 数组，该数组的每一项都是一个依赖集合，然后将该副作用函数从依赖集合中移除，最后重置 effectFn.deps 数组。至此，我们的响应系统已经可以避免副作用函数产生遗留了。但如果你尝试运行代码，会发现目前的实现会导致无限循环执行，问题出在 trigger 函数中：

```js
// 在set 拦截函数内调用 trigger 函数触发变化
function trigger(target, key) {
  const depsMap = bucket.get(target)
  if (!depsMap) return
  const effects = depsMap.get(key)
  effects && effects.forEach(fn => fn())
}
```

遍历副作用集合时，当副作用函数执行时，会调用清理函数，而清理函数执行后，会再次调用副作用函数fn:

```js
function effect(fn) {
  const effectFn = () => {
    // 在这里清理
    cleanup(effectFn)
    activeEffect = effectFn
    // 这里会重新执行函数fn更新视图，再次触发 proxy 的 get 操作
    fn()
  }

  effectFn.deps = []
  effectFn()
}

```

调用fn时，会再次收集依赖到 effects 中，而effects还在遍历，导致一边删除一边新增，就形成了无限循环执行。

创建一个新的 effectsToRun 集合，调用fn后再次收集的依赖 只会更新effects，而不会修改 effectsToRun ：

```js
function trigger(target, key) {
  const depsMap = bucket.get(target)

  if (!depsMap) return

  const effects = depsMap.get(key)

  // effects && effects.forEach(fn => fn())  删除

  const effectsToRun = new Set(effects) // 新增
  effectsToRun.forEach(effectFn => effectFn()) // 新增
}

```

完整的代码：
```js
const data = {
  ok: true,
  text: 'hello world'
}

const bucket = new WeakMap()

let activeEffect

const obj = new Proxy(data, {
  get(target, key) {
    track(target, key)
    return target[key]
  },
  set(target, key, newVal) {
    target[key] = newVal
    trigger(target, key)
  }
})

// 在get拦截函数中内调用track函数追踪变化
function track(target, key) {
  if (!activeEffect) return target[key]
  let depsMap = bucket.get(target)

  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()))
  }

  let deps = depsMap.get(key)
  if (!deps) {
    depsMap.set(key, (deps = new Set()))
  }

  deps.add(activeEffect)
  activeEffect.deps.push(deps)
}

// 在set 拦截函数内调用 trigger 函数触发变化
function trigger(target, key) {
  const depsMap = bucket.get(target)
  if (!depsMap) return
  const effects = depsMap.get(key)
  effects && effects.forEach(fn => fn())
}

// effect 函数用于注册副作用函数，将副作用函数 fn 赋值给 activeEffect
function effect(fn) {
  const effectFn = () => {
    // 当effectFn 执行时，将其设置为当前激活的副作用函数
    cleanup(effectFn)
    activeEffect = effectFn
    fn()
  }

  effectFn.deps = []
  effectFn()
}

function cleanup(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i]
    deps.delete(effectFn)
  }
  effectFn.deps.length = 0
}

effect(() => {
  document.body.innerHTML = obj.ok ? obj.text : 'not'
})

setTimeout(() => {
  obj.ok = false
}, 1000)
```

## 嵌套的 effect 于 effect 栈

effect函数是可以发生嵌套的，例如

```js
effect(function effectFn1(){
  effect(function effectFn2(){ /* ... */ )
  /* ... */
})
```

实际上 Vue.js 的渲染函数就是在一个effect 中执行的：

```js
// 组件 Foo
const Foo = {
  render() {
    return /* .... */
  }
}
```

在 effect 中执行 Foo 组件的渲染函数
```js
effect(() => {
  Foo.render()
})
```

当组件发生嵌套时，例如Foo组件渲染Bar组件

```js
// Bar 组件
const Bar = {
  render() { /* ... */ }
}
// Foo 组件
const Foo = {
  render() {
    return <Bar /> // jsx 语法
  }
}
```

此时发生了effect嵌套
```js
effect(() => {
  Foo.render()

  effect(() => {
    Bar.render()
  })
})
```

我们用全局变量 activeEffect 来存储通过 effect 函数注册的副作用函数，这意味着同一时刻activeEffect 所存储的副作用函数只能有一个。当副作用函数发生嵌套时，内层副作用函数的执行会覆盖 activeEffect 的值，并且永远不会恢复到原来的值。这时如果再有响应式数据进行依赖收集，即使这个响应式数据是在外层副作用函数中读取的，它们收集到的副作用函数也都会是内层副作用函数，这就是问题所在。

我们用全局变量 activeEffect 来存储通过 effect 函数注册的副作用函数，这意味着同一时刻activeEffect 所存储的副作用函数只能有一个。当副作用函数发生嵌套时，内层副作用函数的执行会覆盖 activeEffect 的值，并且永远不会恢复到原来的值。这时如果再有响应式数据进行依赖收集，即使这个响应式数据是在外层副作用函数中读取的，它们收集到的副作用函数也都会是内层副作用函数，这就是问题所在。

```js
// 用一个全局变量存储被注册的副作用函数
let activeEffect

const effectStack = [] // 栈

function effect(fn) {
  const effectFn = () => {
    // 清除
    cleanup(effectFn)
    // 当调用 effect 注册副作用函数时，将副作用函数赋值给activeEffect
    activeEffect = effectFn
    // 在调用副作用函数之前将副作用函数压入栈中
    effectStack.push(effectFn)
    fn()
    // 在副作用函数执行完毕后，将当前副作用函数弹出栈，并把 activeEffect 还原为之前的值
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]

  }

  effectFn.deps = []

  effectFn()
}
```

我们定义了 effectStack 数组，用它来模拟栈，activeEffect 没有变化，它仍然指向当前正在执行的副作用函数。不同的是，当前执行的副作用函数会被压入栈顶，这样当副作用函数发生嵌套时，栈底存储的就是外层副作用函数，而栈顶存储的则是内层副作用函数。

## 避免无限递归循环


## 调度执行
