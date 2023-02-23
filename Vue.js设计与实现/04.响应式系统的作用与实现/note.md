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

看一个例子：

```js
const data = { foo: 1 }
const obj = new Proxy(data, { /* ... */ })

effect(() => obj.foo ++ )
```

改造成会导致栈溢出：

``` js
Uncaught RangeError: Maximum call stack size exceeded
```

`obj.foo++` 这个操作可以分开来看：

```js
effect(() => {
  obj.foo = obj.foo + 1
})
```

在该语句中，即会读取obj.foo，又会设置obj.foo 的值；首先读取obj.foo 的值，这会触发 track 操作，将当前副作用函数收集到“桶”中，接着将其加 1 后再赋值给 obj.foo，此时会触发 trigger 操作，即把“桶”中的副作用函数取出并执行。但问题是该副作用函数正在执行中，还没有执行完毕，就要开始下一次的执行。这样会导致无限递归地调用自己，于是就产生了栈溢出。

那么如何解决这个问题呢？

我们可以在 trigger 动作发生时增加守卫条件：**如果 trigger 触发执行的副作用函数与当前正在执行的副作用函数相同，则不触发执行**，如以下代码所示：

```js
// 在set 拦截函数内调用 trigger 函数触发变化
function trigger(target, key) {
  const depsMap = bucket.get(target)

  if (!depsMap) return

  const effects = depsMap.get(key)
  const effectsToRun = new Set()

  effects && effects.forEach(effectFn => {
    // 如果 trigger 触发执行的副作用函数和与当前执行的副作用函数相同，则不触发
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn)
    }
  })

  effectsToRun.forEach(effectFn => effectFn())
}
```

## 调度执行

什么是可调度性：指的是**当 trigger 动作触发副作用函数重新执行时，有能力决定副作用函数执行的时机、次数以及方式**

### 执行时机

为effect 函数设计一个选项参数options，允许用户指定调度器：

```js
effect(
  () => {
    console.log(obj.foo)
  },
  // options
  {
    // 调度器函数 参数 fn 为 trigger 动作触发的副作用函数
    scheduler(fn) {
      // ...
    }
  }
)
```

```js
// effect 函数用于注册副作用函数，将副作用函数 fn 赋值给 activeEffect
function effect(fn, options = {}) {
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
  // 将 options 挂载到 effectFn 上
  effectFn.options = options
  effectFn.deps = []
  effectFn()
}
```

```js
// 在set 拦截函数内调用 trigger 函数触发变化
function trigger(target, key) {
  const depsMap = bucket.get(target)

  if (!depsMap) return

  const effects = depsMap.get(key)
  const effectsToRun = new Set()

  effects && effects.forEach(effectFn => {
    // 如果 trigger 触发执行的副作用函数和与当前执行的副作用函数相同，则不触发
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn)
    }
  })

  effectsToRun.forEach(effectFn => {
    // 如果一个副作用函数存在调度器，则调用该调度器，并将副作用函数作为参数传递
    if(effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn)
    }else {
      effectFn()
    }
  })
}
```

现在用户可以自己决定副作用函数调用的时机：
```js
effect(
  () => {
    console.log(obj.foo)
  },
  // options
  {
    // 调度器函数 参数 fn 为 trigger 动作触发的副作用函数
    scheduler(fn) {
      // 将副作用函数放到宏任务队列中执行
      setTimeout(fn)
    }
  }
)
```

### 执行次数

看一个例子：

```js
const data = { foo: 1 }
const obj = new Proxy(data, { /* ... */ })

effect(() => {
  console.log(obj.foo)
})

obj.foo()
obj.foo()
```

输出结果：
```js
1
2
3
```

字段 obj.foo 的值一定会从 1 自增到 3，2 只是它的过渡状态。如果我们只关心最终结果而不关心过程，那么执行三次打印操作是多余的，我们期望的打印结果是：

```js
1
3
```

功能实现：

```js
// 定义一个任务队列
const jobQueue = new Set()
// 使用 Promise.resolve() 创建一个promise实例，我们用它将一个任务添加到微队列
const p = Promise.resolve()
// 一个标识代表是否在刷新队列
let isFlushing = false
function flushJob() {
  // 如果正在刷新，则什么都不做
  if(isFlushing) return

  // 代表正在刷新
  isFlushing = true

  // 在微任务队列中刷新 jobQueue 任务
  p.then(() => {
    jobQueue.forEach(job => job())
  }).finally(() => {
    // 结束后重置 isFlusing
    isFlushing = false
  })
}

effect(
  () => {
    console.log(obj.foo)
  },
  // options
  {
    // 调度器函数 参数 fn 为 trigger 动作触发的副作用函数
    scheduler(fn) {
      // 每次调度时，将副作用函数添加到 jobQueue 队列中
      jobQueue.add(fn)
      flushJob()
    }
  }
)

obj.foo()
obj.foo()
```

观察上面的代码，首先，我们定义了一个任务队列 jobQueue，它是一个 Set 数据结构，目的是利用 Set 数据结构的自动去重能力。接着我们看调度器scheduler 的实现，在每次调度执行时，先将当前副作用函数添加到jobQueue 队列中，再调用 flushJob 函数刷新队列。然后我们把目光转向flushJob 函数，该函数通过 isFlushing 标志判断是否需要执行，只有当其为false 时才需要执行，而一旦 flushJob 函数开始执行，isFlushing 标志就会设置为 true，意思是无论调用多少次 flushJob 函数，在一个周期内都只会执行一次。需要注意的是，在 flushJob 内通过 p.then 将一个函数添加到微任务队列，在微任务队列内完成对 jobQueue 的遍历执行。

整段代码的效果是，连续对 obj.foo 执行两次自增操作，会同步且连续地执行两次 scheduler 调度函数，这意味着同一个副作用函数会被jobQueue.add(fn) 语句添加两次，但由于 Set 数据结构的去重能力，最终jobQueue 中只会有一项，即当前副作用函数。类似地，flushJob 也会同步且连续地执行两次，但由于 isFlushing 标志的存在，实际上 flushJob 函数在一个事件循环内只会执行一次，即在微任务队列内执行一次。当微任务队列开始执行时，就会遍历 jobQueue 并执行里面存储的副作用函数。由于此时jobQueue 队列内只有一个副作用函数，所以只会执行一次，并且当它执行时，字段 obj.foo 的值已经是 3 了，这样我们就实现了期望的输出：

```js
1
3
```

## 4.8. 计算属性 computed 与 lazy

track函数：追踪和收集依赖  trigger函数：触发副作用函数的重新执行

基于上面学习的内容，就可以实现一个非常重要的功能——计算属性

### lazy effect

懒执行的effect

例如：
```js
effect(
  //这个函数会立即执行
  () => {
    /* ... */
  }
)
```
某些场景下，我们不希望它立即执行，而是希望在需要的时候执行，例如计算属性。这时我们可以通过在options 中添加lazy属性来达到目的：

```js
effect(
  //指定了 lazy 项，这个函数不会立即执行
  () => {
    /* ... */
  },
  {
    lazy: true
  }
)
```
lazy 选项和之前的 scheduler 一样，通过options选项指定对象。有了它我们来修改effect函数的实现逻辑。

```js
function effect(fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn)
    activeEffect = effectFn
    effectStack.push(effectFn)
    fn()
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]
  }
  effectFn.options = options
  effectFn.deps = []

  // 非lazy时，才执行
  if(!options.lazy) {
    // 执行副作用函数
    effectFn()
  }
  // 将副作用函数作为返回值
  return effectFn()
}
```

再通过调用effect函数的返回值，即可手动执行副作用函数：

```js
const effectFn = effect(() => {
  console.log(obj.foo)
}, {lazy: true})

// 手动执行副作用函数
effectFn()
```

如果我们把传递给 effect 的函数看作是一个getter，那么这个getter函数可以返回任何值：

```js
const effectFn = effect(
  () => obj.foo + obj.bar,
  { lazy: true }
)
```

这样我们手动执行副作用函数就可以拿到返回值：

```js
const effectFn = effect(
  () => obj.foo + obj.bar,
  { lazy: true }
)

const value = effectFn()
```

为了实现上面的目标，我们需要修改 effect 函数：

```js
function effect(fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn)
    activeEffect = effectFn
    effectStack.push(effectFn)
    // 将 fn 的执行结果存储到res中
    const res = fn()
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]
    // 将res 作为 effectFn 的返回值
    return res
  }
  effectFn.options = options
  effectFn.deps = []

  // 非lazy时，才执行
  if(!options.lazy) {
    // 执行副作用函数
    effectFn()
  }
  // 将副作用函数作为返回值
  return effectFn()
}
```

通过新增的代码可以看到，传递给 effect 函数的参数 fn 才是真正的副作用函数，而 effectFn 是我们包装后的副作用函数。为了通过 effectFn 得到真正的副作用函数 fn 的执行结果，我们需要将其保存到 res 变量中，然后将其作为 effectFn 函数的返回值。

现在实现计算属性：

```js
function computed(getter) {
  // 把getter当做副作用函数，创建一个 lazy effect
  const effectFn = effect(getter, {
    lazy: true
  })

  const obj = {
    // 当读取 value 时才执行 effectFn
    get value() {
      return effectFn()
    }
  }

  return obj
}
```
首先我们定义一个 computed 函数，它接收一个 getter 函数作为参数，我们把 getter 函数作为副作用函数，用它创建一个 lazy 的 effect。computed 函数的执行会返回一个对象，该对象的 value 属性是一个访问器属性，只有当读取 value 的值时，才会执行 effectFn 并将其结果作为返回值返回。

```js
const data = {foo: 1, bar: 2}
const obj = new Proxy(data, { /* ... */ })

const sumRes = computed(() => obj.foo + obj.bar)
console.log(sumRes) // 3
```

以上我们就实现的计算属性实现了懒计算，但是还缺少缓存，当多次访问sumRes时，会导致 effectFn进行多次计算，但是值都是没变的。

要解决上面的我问题，需要给计算属性加缓存功能：

```js
function computed(getter) {
  // value 用来缓存上一次的计算值
  let value;
  // dirty 标志，用来标识是否需要重新计算值，true 则意味着“脏”，需要计算
  let dirty = true
  // 把getter当做副作用函数，创建一个 lazy effect
  const effectFn = effect(getter, {
    lazy: true
  })

  const obj = {
    // 当读取 value 时才执行 effectFn
    get value() {
      // 只有 “脏” 才需要重新计算，将计算值缓存到 value 中
      if(dirty) {
        value = effectFn()
        // 下一次访问时直接用缓存里的 value 值
        dirty = false
      }
      return value
    }
  }

  return obj
}
```

新增了两个变量 value 和 dirty，其中 value 用来缓存上一次计算的值，而 dirty 是一个标识，代表是否需要重新计算。当我们通过 sumRes.value 访问值时，只有当 dirty 为 true 时才会调用effectFn 重新计算值，否则直接使用上一次缓存在 value 中的值。

但是又有了一个新的问题，就是当我们修改obj.foo 或者 obj.bar 的值，访问的sumRes.value 还是没有变化:

```js
const data = {foo: 1, bar: 2}
const obj = new Proxy(data, { /* ... */ })

const sumRes = computed(() => obj.foo + obj.bar)
console.log(sumRes) // 3

obj.foo ++

console.log(sumRes) // 3
```

解决办法很简单，当 obj.foo 或 obj.bar 的值发生变化时，只要 dirty 的值重置为 true 就可以了。那么应该怎么做呢？这时就用到了上一节介绍的 scheduler 选项:

```js
function computed(getter) {
  let value;
  let dirty = true
  const effectFn = effect(getter, {
    lazy: true,
    // 添加调度器，在调度器中将 dirty 修改为 true
    scheduler() {
      dirty = true
    }
  })

  const obj = {
    get value() {
      if(dirty) {
        value = effectFn()
        dirty = false
      }
      return value
    }
  }

  return obj
}
```

我们为 effect 添加了 scheduler 调度器函数，它会在 getter 函数中所依赖的响应式数据变化时执行，这样我们在 scheduler 函数内将 dirty 重置为 true，当下一次访问 sumRes.value 时，就会重新调用 effectFn 计算值。

但是还有一个小缺陷，当我们在另一个effect中读取计算属性时：

```js
const sumRes = computed(() => obj.foo + obj.bar)

effect(() => {
  // 在该副作用函数中读取 sumRes.value
  console.log(sumRes.value)
})

obj.foo++
```

如以上代码所示，sumRes 是一个计算属性，并且在另一个 effect 的副作用函数中读取了sumRes.value 的值。如果此时修改 obj.foo 的值，我们期望副作用函数重新执行，就像我们在Vue.js 的模板中读取计算属性值的时候，一旦计算属性发生变化就会触发重新渲染一样。但是如果尝试运行上面这段代码，会发现修改 obj.foo 的值并不会触发副作用函数的渲染，因此我们说这是一个缺陷。

分析问题的原因，我们发现，从本质上看这就是一个典型的 effect 嵌套。一个计算属性内部拥有自己的 effect，并且它是懒执行的，只有当真正读取计算属性的值时才会执行。对于计算属性的 getter 函数来说，它里面访问的响应式数据只会把 computed 内部的 effect 收集为依赖。而当把计算属性用于另外一个 effect 时，就会发生 effect 嵌套，外层的 effect 不会被内层 effect 中的响应式数据收集。

解决办法很简单。当读取计算属性的值时，我们可以手动调用 track 函数进行追踪；当计算属性依赖的响应式数据发生变化时，我们可以手动调用 trigger 函数触发响应：

```js
function computed(getter) {
  let value;
  let dirty = true
  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      dirty = true
      // 当计算属性依赖的响应式数据发生变化时，手动调用 trigger 函数触发响应
      trigger(obj, 'value')
    }
  })

  const obj = {
    get value() {
      if(dirty) {
        value = effectFn()
        dirty = false
      }

      // 当读取 value 时，手动调用 track 函数进行追踪
      track(obj, 'value')
      return value
    }
  }

  return obj
}
```

如以上代码所示，当读取一个计算属性的 value 值时，我们手动调用 track 函数，把计算属性返回的对象 obj 作为 target，同时作为第一个参数传递给 track 函数。当计算属性所依赖的响应式数据变化时，会执行调度器函数，在调度器函数内手动调用 trigger 函数触发响应即可。


## 4.9 watch 的实现原理

watch 就是监听一个响应式数据，当数据发生变化时通知并执行相应的回调函数:

```js
watch(obj, () => {
  console.log('数据发送变化了')
})

// 修改响应式数据的值，会导致回调函数的执行
obj.foo++
```

实际上，watch 的实现本质上就是利用了 effect 以及 options.scheduler 选项，如以下代码所示：

```js
effect(
  () => {
    console.log(obj.foo)
  },
  {
    scheduler() {
      // 当 obj.foo 的值变化是，会执行 scheduler 调度函数
    }
  }
)
```

在一个副作用函数中访问响应式数据 obj.foo，通过前面的介绍，我们知道这会在副作用函数与响应式数据之间建立联系，当响应式数据变化时，会触发副作用函数重新执行。但有一个例外，即如果副作用函数存在 scheduler 选项，当响应式数据发生变化时，会触发 scheduler 调度函数执行，而非直接触发副作用函数执行。从这个角度来看，其实 scheduler 调度函数就相当于一个回调函数，而watch 的实现就是利用了这个特点。下面是最简单的 watch 函数的实现：

```js
/**
 * source 响应式数据
 * cb 回调函数
 */
function watch(source, cb) {
  effect(
    // 触发读取操作，从而建立联系
    () => source.foo,
    {
      scheduler() {
        // 当数据变化时，执行回调函数cb
        cb()
      }
    }
  )
}
```

使用 watch 函数：

```js
const data = {foo：1}

const obj = new Proxy(data, { /* ... */ })

watch(obj, () => {
  console.log('变化了')
})

obj.foo++
```

上面这段代码可以正常运行，但是 source.foo 的读取是硬编码操作，需要封装一个通用的方法：

```js
function watch(source, cb) {
  effect(
    // 调用 traverse 函数递归的读取
    () => traverse(source),
    {
      scheduler() {
        // 当数据变化时，执行回调函数cb
        cb()
      }
    }
  )
}

function traverse(value, seen = new Set()) {
  // 如果读取的值时一个原始值，或者已被读取过，那么直接返回
  if (typeof value !== 'object' || value === null || seen.has(value)) return
  // 将数据添加到seen中，代表遍历读取过，避免循环引用
  seen.add(value)

  // 加上value是一个对象，使用 for..in 读取对象的每个值，并递归调用 traverse 进行处理
  for (const k in value) {
    traverse(value[key], seen)
  }

  return value
}
```

如上面的代码所示，在 watch 内部的 effect 中调用 traverse 函数进行递归的读取操作，代替硬编码的方式，这样就能读取一个对象上的任意属性，从而当任意属性发生变化时都能够触发回调函数执行。

watch 函数除了可以观测响应式数据，还可以接收一个 getter 函数：

```js

watch(() => obj.foo, () => {
  console.log('obj.foo改变了')
})
```

如以上代码所示，传递给 watch 函数的第一个参数不再是一个响应式数据，而是一个 getter 函数。在 getter 函数内部，用户可以指定该 watch 依赖哪些响应式数据，只有当这些数据变化时，才会触发回调函数执行。如下代码实现了这一功能：

```js
function watch(source, cb) {
  // 定义getter
  let getter

  // 如果 source 是一个函数，说明用户传递的是一个getter，所有直接赋值就可以了
  if (typeof source === 'function') {
    getter = source
  }
  // 否则按照原来的实现调用 traverse 递归调用读取
  else {
    getter = () => traverse(source)
  }

  effect(
    // 执行 getter
    () => getter(),
    {
      scheduler() {
        cb()
      }
    }
  )
}

```
首先判断 source 的类型，如果是函数类型，说明用户直接传递了 getter 函数，这时直接使用用户的getter 函数；如果不是函数类型，那么保留之前的做法，即

现在的实现还缺少一个非常重要的能力，即在回调函数中拿不到旧值与新值。通常我们在使用 Vue.js 中的 watch 函数时，能够在回调函数中得到变化前后的值：

```js
watch(() => obj.foo, (newValue, oldValue) => {
  console.log(newValue, oldValue)
})
```

那么如何获得新值与旧值呢？这需要充分利用 effect 函数的 lazy 选项，如以下代码所示

```js
function watch(source, cb) {
  let getter
  if (typeof source === 'function') {
    getter = source
  }else {
    getter = () => traverse(source)
  }

  // 定义新值和旧值
  let oldValue, newValue
  // 使用effect 注册副作用函数，开启lazy选项，并把返回值存储到effectFn 中以便后续手动调用
  const effectFn = effect(
    () => getter(),
    {
      lazy: true,
      scheduler() {
        // 重新执行副作用函数
        newValue = effectFn()
        // 将旧值和新增作为回调函数的参数
        cb(newValue, oldValue)
        // 更新旧值，不然下次会得到错误的旧值
        oldValue = newValue
      }
    }
  )
  // 手动调用副作用函数，拿到的值就是旧值
  oldValue = effectFn()
}
```

在这段代码中，最核心的改动是使用 lazy 选项创建了一个懒执行的 effect。注意上面代码中最下面的部分，我们手动调用 effectFn 函数得到的返回值就是旧值，即第一次执行得到的值。当变化发生并触发 scheduler 调度函数执行时，会重新调用 effectFn 函数并得到新值，这样我们就拿到了旧值与新值，接着将它们作为参数传递给回调函数 cb 就可以了。最后一件非常重要的事情是，不要忘记使用新值更新旧值：oldValue = newValue，否则在下一次变更发生时会得到错误的旧值。


## 4.10 立即执行的 watch 与回调执行时机

watch 的本质其实是对 effect 的二次封装。本节我们继续讨论关于 watch 的两个特性：一个是立即执行的回调函数，另一个是回调函数的执行时机。

### 立即执行 watch 的回调函数

在 Vue.js 中可以通过选项参数 immediate 来指定回调是否需要立即执行：

```js
watch(obj, () => {
  console.log('change')
}, {
  immediate: true
})
```

当 immediate 选项存在并且为 true 时，回调函数会在该 watch 创建时立刻执行一次。仔细思考就会发现，回调函数的立即执行与后续执行本质上没有任何差别，所以我们可以把 scheduler 调度函数封装为一个通用函数，分别在初始化和变更时执行它，如以下代码所示：

```js
function watch(source, cb, options = {}) {
  let getter
  if (typeof source === 'function') {
    getter = source
  }
  // 否则按照原来的实现调用 traverse 递归调用
  else {
    getter = () => traverse(source)
  }

  let oldValue, newValue

  const job = () => {
    newValue = effectFn()
    cb(newValue, oldValue)
    oldValue = newValue
  }

  const effectFn = effect(
    () => getter(),
    {
      lazy: true,
      scheduler: job
    }
  )

  if (options.immediate) {
    job()
  } else {
    oldValue = effectFn()
  }
}
```

### 指定 watch 回调函数的执行时机

除了指定回调函数为立即执行之外，还可以通过其他选项参数来指定回调函数的执行时机，例如在Vue.js 3 中使用 flush 选项来指定：

```js
watch(obj, () => {
  console.log('change')
}, {
  flush: 'pre' // 还可以设置 ‘post’ | ‘sync’
})
```

flush 本质上是在指定调度函数的执行时机。前文讲解过如何在微任务队列中执行调度函数scheduler，这与 flush 的功能相同。当 flush 的值为 'post' 时，代表调度函数需要将副作用函数放到一个微任务队列中，并等待 DOM 更新结束后再执行，我们可以用如下代码进行模拟：

```js
function watch(source, cb, options = {}) {
  let getter
  if (typeof source === 'function') {
    getter = source
  }
  // 否则按照原来的实现调用 traverse 递归调用
  else {
    getter = () => traverse(source)
  }

  let oldValue, newValue

  const job = () => {
    newValue = effectFn()
    cb(newValue, oldValue)
    oldValue = newValue
  }

  const effectFn = effect(
    () => getter(),
    {
      lazy: true,
      scheduler: () => {
        // 如果flush 为 post，将其放到微任务队列中执行
        if(options.flush === 'post') {
          const p = Promise.resolve()
          p.then(job)
        }else {
          job()
        }
      }
    }
  )

  if (options.immediate) {
    job()
  } else {
    oldValue = effectFn()
  }
}
```

## 4.11 过期的副作用

竞态问题通常在多进程或多线程编程中被提及，前端工程师可能很少讨论它，但在日常工作中你可能早就遇到过与竞态问题相似的场景，举个例子：

```js
let finalData

watch(obj, async () => {
  const res = await fetch('/path/to/request')
  finalData = res
})
```

假设我们第一次修改 obj 对象的某个字段值，这会导致回调函数执行，同时发送了第一次请求 A。随着时间的推移，在请求 A 的结果返回之前，我们对 obj 对象的某个字段值进行了第二次修改，这会导致发送第二次请求 B。此时请求 A 和请求 B 都在进行中，那么哪一个请求会先返回结果呢？我们不确定，如果请求 B 先于请求 A 返回结果，就会导致最终 finalData 中存储的是 A 请求的结果。

请求 A 是副作用函数第一次执行所产生的副作用，请求B 是副作用函数第二次执行所产生的副作用。由于请求 B 后发生，所以请求 B 的结果应该被视为“最新”的，而请求 A 已经“过期”了，其产生的结果应被视为无效。通过这种方式，就可以避免竞态问题导致的错误结果。

在 Vue.js 中，watch 函数的回调函数接收第三个参数 onInvalidate，它是一个函数，类似于事件监听器，我们可以使用 onInvalidate 函数注册一个回调，这个回调函数会在当前副作用函数过期时执行：

```js
let finalData

watch(obj, async(newVal, oldVal, onInvalidate) => {
  let expired = false

  onInvalidate(() => {
    // 当过期时，将expired设置为true
    expired = true
  })

  const res = await fetch('/path/to/request')

  // 当副作用函数的执行没有过期时，才会执行后续操作
  if(!expired) {
    finalData = res
  }
})

```

那么 Vue.js 是怎么做到的呢？换句话说，onInvalidate 的原理是什么呢？其实很简单，在 watch 内部每次检测到变更后，在副作用函数重新执行之前，会先调用我们通过 onInvalidate 函数注册的过期回调，仅此而已，如以下代码所示：

```js

function watch(source, cb, options = {}) {
  let getter
  if (typeof source === 'function') {
    getter = source
  }else {
    getter = () => traverse(source)
  }

  let oldValue, newValue

  // cleanup 用来清理存储用户注册的的函数
  let cleanup

  function onInvalidate(fn) {
    // 将过期回调存储到cleanup
    cleanup = fn
  }

  const job = () => {
    newValue = effectFn()
    // 在的调用回调函数cb之前，先调用过期回调
    if(cleanup) {
      cleanup()
    }

    // 将 onInvalidate 最为回调函数的第三参数
    cb(newValue, oldValue, onInvalidate)
    oldValue = newValue
  }

  const effectFn = effect(
    () => getter(),
    {
      lazy: true,
      scheduler: () => {
        if (options.flush === 'post') {
          const p = Promise.resolve()
          p.then(job)
        } else {
          job()
        }
      }
    }
  )

  if (options.immediate) {
    job()
  } else {
    oldValue = effectFn()
  }
}
```

## 4.12 总结

在本章中，我们首先介绍了副作用函数和响应式数据的概念，以及它们之间的关系。一个响应式数据最基本的实现依赖于对“读取”和“设置”操作的拦截，从而在副作用函数与响应式数据之间建立联系。当“读取”操作发生时，我们将当前执行的副作用函数存储到“桶”中；当“设置”操作发生时，再将副作用函数从“桶”里取出并执行。这就是响应系统的根本实现原理。

接着，我们实现了一个相对完善的响应系统。使用 WeakMap 配合 Map 构建了新的“桶”结构，从而能够在响应式数据与副作用函数之间建立更加精确的联系。同时，我们也介绍了 WeakMap 与 Map 这两个数据结构之间的区别。WeakMap 是弱引用的，它不影响垃圾回收器的工作。当用户代码对一个对象没有引用关系时，WeakMap 不会阻止垃圾回收器回收该对象。

我们还讨论了分支切换导致的冗余副作用的问题，这个问题会导致副作用函数进行不必要的更新。为了解决这个问题，我们需要在每次副作用函数重新执行之前，清除上一次建立的响应联系，而当副作用函数重新执行后，会再次建立新的响应联系，新的响应联系中不存在冗余副作用问题，从而解决了问题。但在此过程中，我们还遇到了遍历 Set 数据结构导致无限循环的新问题，该问题产生的原因可以从 ECMA 规范中得知，即“在调用 forEach 遍历 Set 集合时，如果一个值已经被访问过了，但这个值被删除并重新添加到集合，如果此时 forEach 遍历没有结束，那么这个值会重新被访问。”解决方案是建立一个新的 Set 数据结构用来遍历。

然后，我们讨论了关于嵌套的副作用函数的问题。在实际场景中，嵌套的副作用函数发生在组件嵌套的场景中，即父子组件关系。这时为了避免在响应式数据与副作用函数之间建立的响应联系发生错乱，我们需要使用副作用函数栈来存储不同的副作用函数。当一个副作用函数执行完毕后，将其从栈中弹出。当读取响应式数据的时候，被读取的响应式数据只会与当前栈顶的副作用函数建立响应联系，从而解决问题。而后，我们遇到了副作用函数无限递归地调用自身，导致栈溢出的问题。该问题的根本原因在于，对响应式数据的读取和设置操作发生在同一个副作用函数内。解决办法很简单，如果 trigger 触发执行的副作用函数与当前正在执行的副作用函数相同，则不触发执行。

随后，我们讨论了响应系统的可调度性。所谓可调度，指的是当 trigger 动作触发副作用函数重新执行时，有能力决定副作用函数执行的时机、次数以及方式。为了实现调度能力，我们为 effect 函数增加了第二个选项参数，可以通过 scheduler 选项指定调用器，这样用户可以通过调度器自行完成任务的调度。我们还讲解了如何通过调度器实现任务去重，即通过一个微任务队列对任务进行缓存，从而实现去重。

而后，我们讲解了计算属性，即 computed。计算属性实际上是一个懒执行的副作用函数，我们通过lazy 选项使得副作用函数可以懒执行。被标记为懒执行的副作用函数可以通过手动方式让其执行。利用这个特点，我们设计了计算属性，当读取计算属性的值时，只需要手动执行副作用函数即可。当计算属性依赖的响应式数据发生变化时，会通过 scheduler 将 dirty 标记设置为 true，代表“脏”。这样，下次读取计算属性的值时，我们会重新计算真正的值。

之后，我们讨论了 watch 的实现原理。它本质上利用了副作用函数重新执行时的可调度性。一个watch 本身会创建一个 effect，当这个 effect 依赖的响应式数据发生变化时，会执行该 effect 的调度器函数，即 scheduler。这里的 scheduler 可以理解为“回调”，所以我们只需要在 scheduler 中执行用户通过 watch 函数注册的回调函数即可。此外，我们还讲解了立即执行回调的 watch，通过添加新的 immediate 选项来实现，还讨论了如何控制回调函数的执行时机，通过 flush 选项来指定回调函数具体的执行时机，本质上是利用了调用器和异步的微任务队列。

最后，我们讨论了过期的副作用函数，它会导致竞态问题。为了解决这个问题，Vue.js 为 watch 的回调函数设计了第三个参数，即 onInvalidate。它是一个函数，用来注册过期回调。每当 watch 的回调函数执行之前，会优先执行用户通过 onInvalidate 注册的过期回调。这样，用户就有机会在过期回调中将上一次的副作用标记为“过期”，从而解决竞态问题。
