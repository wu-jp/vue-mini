# 组件的实现原理

渲染器主要负责将虚拟DOM渲染为真实DOM，我们只需要使用虚拟DOM来描述最终呈现的内容即可。当是当页面内容比较复杂时，虚拟DOM的结构也越来越复杂。这时就需要组件化的能力了。

## 1. 渲染组件

一个组件必须包含一个渲染函数，即render 函数，并且渲染函数的返回值应该是虚拟 DOM。换句话说，组件的渲染函数就是用来描述组件所渲染内容的接口。

```js
const MyComponent = {
  name: 'MyComponent',
  render() {
    return {
      type: 'div',
      children: '我是一个文本'
    }
  }
}

const CompVNode = {
  type: MyComponent
}
```

在 patch 函数中对组件类型的虚拟节点进行处理，如下面的代码所示：

```js
function patch(n1, n2, container, anchor) {
    if (n1 && n1.type !== n2.type) {
      unmount(n1)
      n1 = null
    }
    const { type } = n2

    if (typeof type === 'string') {
      // 忽略部分代码
    } else if (typeof type === 'object') {
      // 如果n2的类型时一个对象，则它描述的是组件
      if (!n1) {
        // 挂载组件
        mountComponent(n2, container, anchor)
      } else {
        // 更新组件
        patchComponent(n1, n2, anchor)
      }
    } else if (type === Text) {
      // 忽略部分代码
    } else if (type === Fragment) {
      // 忽略部分代码
    }
  }
```

有了基本的组件结构之后，渲染器就可以完成组件的渲染，如下面的代码所示：

```js
const render = createRenderer(APIOptions)  // APIOptions为操作各平台API的配置
render(CompVNode, document.querySelector('#app'))
```

渲染器中真正完成组件渲染任务的是 mountComponent 函数，其具体实现如下所示：

```js
/**
 * 挂载组件
 * @param {*} vnode 挂载的虚拟DOM组件
 * @param {*} container 容器
 * @param {*} anchor 锚点
 */
export function mountComponent(vnode, container, anchor) {
  // 获取组件的配置对象，即 vnode.type
  const componentOptions = vnode.type
  // 获取组件的渲染函数
  const { render, data } = componentOptions

  const subTree = render()
  const status = reactive(data())

  patch(null, subTree, container, anchor)
}
```

## 2.组件状态与自更新

在组件中添加状态：
```js
const MyComponent = {
  name: 'MyComponent',
  data() {
    return {
      foo: 'hello world'
    }
  },
  render() {
    return {
      type: 'div',
      children: '我是一个文本'
    }
  }
}
```

约定用户必须使用 data 函数来定义组件自身的状态，同时可以在渲染函数中通过 this 访问由 data 函数返回的状态数据。

当组件自身状态发生变化时，我们需要有能力触发组件更新，即组件的自更新。为此，我们需要将整个渲染任务包装到一个 effect 中：

```js
export function mountComponent(vnode, container, anchor) {
  // 获取组件的配置对象，即 vnode.type
  const componentOptions = vnode.type
  // 获取组件的渲染函数
  const { render, data } = componentOptions
  // 调用data函数得到原始数据，并调用reactive函数将其包装为响应式数据
  const state = reactive(data())

  // 将组件的 render 函数调用包装到 effect 内
  effect(() => {
    // 调用render函数时，将其this指向state，从而在render函数内部可以通过this访问组件自身状态数据
    const subTree = render.call(state, state)
    patch(null, subTree, container, anchor)
  })
}
```

一旦组件自身的响应式数据发生变化，组件就会自动重新执行渲染函数，从而完成更新。但是，由于 effect 的执行是同步的，因此当响应式数据发生变化时，与之关联的副作用函数会同步执行。换句话说，如果多次修改响应式数据的值，将会导致渲染函数执行多次，这实际上是没有必要的。因此，我们需要设计一个机制，以使得无论对响应式数据进行多少次修改，副作用函数都只会重新执行一次。为此，我们需要实现一个调度器，当副作用函数需要重新执行时，我们不会立即执行它，而是将它缓冲到一个微任务队列中，等到执行栈清空后，再将它从微任务队列中取出并执行。有了缓存机制，我们就有机会对任务进行去重，从而避免多次执行副作用函数带来的性能开销。

```js
// 任务缓存队列，用一个Set 数据结构来表示，这样就可以自动对任务去重
const queue = new Set()
// 定义一个标志，代表是否正在刷新任务队列
const isFlushing = false
// 创建一个立即 resolve 的 Promise 实例
const p = Promise.resolve()

// 调度器的主函数，用来将一个任务添加到缓冲队列中，并开始刷新队列
export function queueJob(job) {
  // 将job加添到任务队列中
  queue.add(job)
  // 如果还没有开始刷新队列，则刷新☞
  if (!isFlushing) {
    // 将标志设为true， 放在重复刷新
    isFlushing = true
    //在微任务中刷新缓冲队列
    p.then(() => {
      try {
        // 执行任务队列中的任务
        queue.forEach(job => job())
      } finally {
        // 重置状态
        isFlushing = false
        queue.clear = 0
      }
    })
  }
}
```

上面是调度器的最小实现，本质上利用了微任务的异步执行机制，实现对副作用函数的缓冲。其中queueJob 函数是调度器最主要的函数，用来将一个任务或副作用函数添加到缓冲队列中，并开始刷新队列。有了 queueJob 函数之后，我们可以在创建渲染副作用时使用它，如下面的代码所示：

```js
export function mountComponent(vnode, container, anchor) {
  // 获取组件的配置对象，即 vnode.type
  const componentOptions = vnode.type
  // 获取组件的渲染函数
  const { render, data } = componentOptions
  // 调用data函数得到原始数据，并调用reactive函数将其包装为响应式数据
  const state = reactive(data())

  // 将组件的 render 函数调用包装到 effect 内
  effect(() => {
    // 调用render函数时，将其this指向state，从而在render函数内部可以通过this访问组件自身状态数据
    const subTree = render.call(state, state)
    patch(null, subTree, container, anchor)
  }, {
    scheduler: queueJob
  })
}
```

这样，当响应式数据发生变化时，副作用函数不会立即同步执行，而是会被 queueJob 函数调度，最后在一个微任务中执行。


我们在 effect 函数内调用 patch 函数完成渲染时，第一个参数总是 null。这意味着，每次更新发生时都会进行全新的挂载，而不会打补丁，这是不正确的。正确的做法是：每次更新时，都拿新的 subTree 与上一次组件所渲染的 subTree 进行打补丁。为此，我们需要实现组件实例，用它来维护组件整个生命周期的状态，这样渲染器才能够在正确的时机执行合适的操作。

## 3.组件实例与组件的说明周期

我们使用一个对象来表示组件实例，该对象有三个属性。
- state：组件自身的状态数据，即 data。
- isMounted：一个布尔值，用来表示组件是否被挂载。
- subTree：存储组件的渲染函数返回的虚拟 DOM，即组件的子树（subTree）。

实际上，我们可以在需要的时候，任意地在组件实例 instance 上添加需要的属性。但需要注意的是，我们应该尽可能保持组件实例轻量，以减少内存占用。

组件实例的 instance.isMounted 属性可以用来区分组件的挂载和更新。因此，我们可以在合适的时机调用组件对应的生命周期钩子，如下面的代码所示：

```js
export function mountComponent(vnode, container, anchor, patch) {
  // 获取组件的配置对象，即 vnode.type
  const componentOptions = vnode.type
  // 获取组件的渲染函数
  const { render, data, props: propsOption, beforeCreate, created, beforeMount, mounted, beforeUpdate, updated } = componentOptions
  // 在这里调用 beforeCreate 钩子
  beforeCreate && beforeCreate()

  // 调用data函数得到原始数据，并调用reactive函数将其包装为响应式数据
  const state = reactive(data())

  // 调用 resolveProps 函数解析出最终的 props 数据与 attrs 数据
  const [props, attrs] = resolveProps(propsOption, vnode.props)

  // 定义组件实例，一个组件实例本质上就是一个对象，它包含与组件有关的状态选项
  const instance = {
    // 组件自身的状态数据，即data
    state,
    props: shallowReactive(props)
    // 一个布尔值，用来表示组件是否已经别挂载，初始值为false
    isMounted: false,
    // 组件所渲染的内容，即子树（subTree）
    subTree: null
  }

  // 将中将见实例设置到vnode上，用于后续更新
  vnode.component = instance

  // 在这里调用created 钩子
  created && created.call(state)

  // 将组件的 render 函数调用包装到 effect 内
  effect(() => {
    // 调用render函数时，将其this指向state，从而在render函数内部可以通过this访问组件自身状态数据
    const subTree = render.call(state, state)
    // 检查组件是否已经被挂载
    if (!instance.isMounted) {
      // 在这里调用 beforeMount 钩子
      beforeMount && beforeMount.call(state)
      // 初次挂载，调用patch函数第一个参数为null
      patch(null, subTree, container, anchor)
      // 重点：将组件实例的isMounted设置为true，这样当更新发生时就不会再次进行挂载而是执行更新操作
      instance.isMounted = true

      // 在这里调用 mounted 钩子
      mounted && mounted.call(state)
    } else {
      // 在这里调用 beforeUpdate 钩子
      beforeUpdate && beforeUpdate.call(state)
      // 当isMounted 为true时，说明已经被挂载，主要完成更新即可
      // 所以在调用patch时，第一个参数为组件上一次渲染的子树
      // 意思是，使用新的子树与上一次渲染的子树进行打补丁操作
      patch(instance.subTree, subTree, container, anchor)
      // 在这里调用 updated 钩子
      updated && updated.call(state)
    }
    // 更新组件实例的子树
    instance.subTree = subTree

  }, {
    scheduler: queueJob
  })
}
```

我们首先从组件的选项对象中取得注册到组件上的生命周期函数，然后在合适的时机调用它们，这其实就是组件生命周期的实现原理。但实际上，由于可能存在多个同样的组件生命周期钩子，例如来自 mixins 中的生命周期钩子函数，因此我们通常需要将组件生命周期钩子序列化为一个数组，但核心原理不变。

## 4.props 与组件的被动更新

渲染器发现父组件的 subTree 包含组件类型的虚拟节点，所以会调用 patchComponent 函数完成子组件的更新：

```js
import { resolveProps } from "./mountComponet.js"

/**
 * 更新组件
 * @param {*} n1 旧vnode
 * @param {*} n2 新vnode
 * @param {*} anchor 锚点
 */
export function patchComponent(n1, n2, anchor) {
  // 获取组件实例，即n1.component，同时让新的组件虚拟节点 n2.component 也指向组件实例
  const instance = (n2.component = n1.component)

  // 获取当前的props 数据
  const { props } = instance

  // 调用 hasPropsChanged 函数检测为子组件传递的 props 是否发生变化，如果没有变化，则不需要更新
  if (hasPropsChanged(n1.props, n2.props)) {
    // 调用 resolveProps 函数重新获取props数据
    const [nextProps] = resolveProps(n2.type.props, n2.props)

    // 更新props
    for (const k in nextProps) {
      props[k] = nextProps[k]

    }

    // 删除不存在的props
    for (const k in props) {
      if (!(k in nextProps)) delete props[k]
    }
  }
}


export function hasPropsChanged(prevProps, nextProps) {
  const nextKeys = Object.keys(nextProps)
  // 如果新旧 props 的数量变了，则说明有变化
  if (nextKeys.length !== Object.keys(prevProps).length) {
    return true
  }

  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i]
    // 不相同的 props，则说明变化了
    if (nextProps[key] !== prevProps[key]) return true
  }

  return false
}
```

上面是组件被动更新的最小实现，有两点需要注意：

- 需要将组件实例添加到新的组件 vnode 对象上，即 n2.component = n1.component，否则下次更新时将无法取得组件实例；
- instance.props 对象本身是浅响应的（即 shallowReactive）。因此，在更新组件的 props 时，只需要设置 instance.props 对象下的属性值即可触发组件重新渲染。

由于 props 数据与组件自身的状态数据都需要暴露到渲染函数中，并使得渲染函数能够通过 this 访问它们，因此我们需要封装一个渲染上下文对象，如下面的代码所示：

```js
import { queueJob } from "./queueJob.js"
const { reactive, effect, shallowReactive } = VueReactivity


/**
 * 挂载组件
 * @param {*} vnode 挂载的虚拟DOM组件
 * @param {*} container 容器
 * @param {*} anchor 锚点
 * @param {*} patch 补丁
 */
export function mountComponent(vnode, container, anchor, patch) {
  // 省略部分代码

  // 定义组件实例，一个组件实例本质上就是一个对象，它包含与组件有关的状态选项
  const instance = {
    // 组件自身的状态数据，即data
    state,
    // 解析出的 props 数据包装为 shallowReactive 并定义到组件实例上
    props: shallowReactive(props),
    // 一个布尔值，用来表示组件是否已经别挂载，初始值为false
    isMounted: false,
    // 组件所渲染的内容，即子树（subTree）
    subTree: null
  }

  // 将中将见实例设置到vnode上，用于后续更新
  vnode.component = instance

  // 创建渲染上下文对象，本质上是组件实例的代理
  const renderContext = new Proxy(instance, {
    get(t, k, r) {
      // 取得组件自身状态与 props 数据
      const { state, props } = t
      if (state && k in state) {
        return state[k]
      } else if (k in props) {
        // 如果组件自身没有该数据，则尝试从props 中读取
        return props[k]
      } else {
        console.error('不存在')
      }
    },
    set(t, k, v, r) {
      const { state, props } = t
      if (state && k in state) {
        state[k] = v
      } else if (k in props) {
        console.warn('Attempting to mutate prop `${k}`. Props are readonly.')
      } else {
        console.error('不存在')
      }
    }
  })

  // 在这里调用created 钩子
  created && created.call(renderContext)

  // 省略部分代码
}
```

我们为组件实例创建了一个代理对象，该对象即渲染上下文对象。它的意义在于拦截数据状态的读取和设置操作，每当在渲染函数或生命周期钩子中通过 this 来读取数据时，都会优先从组件的自身状态中读取，如果组件本身并没有对应的数据，则再从 props 数据中读取。最后我们将渲染上下文作为渲染函数以及生命周期钩子的 this 值即可。

实际上，除了组件自身的数据以及 props 数据之外，完整的组件还包含 methods、computed 等选项中定义的数据和方法，这些内容都应该在渲染上下文对象中处理。

## 5.setup函数的作用和实现


