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

setup 函数主要用于配合组合式 API，为用户提供一个地方，用于建立组合逻辑、创建响应式数据、创建通用函数、注册生命周期钩子等能力。在组件的整个生命周期中，setup 函数只会在被挂载时执行一次，它的返回值可以有两种情况。

1. 返回一个函数，该函数将作为组件的 render 函数
2. 返回一个对象，该对象中包含的数据将暴露给模板使用

setup 函数接收两个参数。第一个参数是 props 数据对象，第二个参数也是一个对象，通常称为 setupContext。

接下来，我们就围绕上述这些能力来尝试实现 setup 组件选项：

```js
export function mountComponent(vnode, container, anchor, patch) {
  // 获取组件的配置对象，即 vnode.type
  const componentOptions = vnode.type
  // 获取组件的渲染函数
  const { render, data, setup, props: propsOption, beforeCreate, created, beforeMount, mounted, beforeUpdate, updated } = componentOptions
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
    // 解析出的 props 数据包装为 shallowReactive 并定义到组件实例上
    props: shallowReactive(props),
    // 一个布尔值，用来表示组件是否已经别挂载，初始值为false
    isMounted: false,
    // 组件所渲染的内容，即子树（subTree）
    subTree: null
  }

  // NOTE 关于 setup 相关的实现

  // setupContext，由于还没有涉及到 emit 和 slots，所以暂时只需要 attrs
  const setupContext = { attrs }
  // 调用setup函数，将只读版本的 props 作为第一个参数传递，避免用户修改props值
  // 将 setupContext 作为第二个参数传递
  const setupResult = setup(shallowReadonly(instance.props), setupContext)
  // setupState 用来存储 setup 的返回的数据
  let setupState = null
  // 如果 setup 函数的返回值是函数，则将其作为渲染函数
  if (typeof setupResult === 'function') {
    // 冲突报告
    if (render) {
      console.error('setup函数返回渲染函数，render选项将被忽略')
    }
    // 将 setupResult 作为渲染函数
    render = setupResult
  } else {
    // 如果setup 返回值不是函数，则作为数据状态赋值给 setupState
    setupState = setupResult
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
      } else if (setupState && k in setupState) {
        // 渲染上下文需要增加对 setupState 的支持
        return setupState[k]
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
      } else if (setupState && k in setupState) {
        // 渲染上下文需要增加对 setupState 的支持
        setupState[k] = v
      } else {
        console.error('不存在')
      }
    }
  })

  // 在这里调用created 钩子
  created && created.call(renderContext)

  // 省略其他代码
}
```

上面是 setup 函数的最小实现，这里有以下几点需要注意：

- setupContext 是一个对象，由于我们还没有涉及关于 emit 和 slots 的内容，因此 setupContext 暂时只包含 attrs。
- 我们通过检测 setup 函数的返回值类型来决定应该如何处理它。如果它的返回值为函数，则直接将其作为组件的渲染函数。这里需要注意的是，为了避免产生歧义，我们需要检查组件选项中是否已经存在 render 选项，如果存在，则需要打印警告信息。
- 渲染上下文 renderContext 应该正确地处理 setupState，因为 setup 函数返回的数据状态也应该暴露到渲染环境。

## 6. 组件事件与 emit 的实现

通过emit 发射自定义事件：

```js
const MyComponent = {
  name: 'MyComponent',
  setup(props, {emit}) {
    emit('change', 1, 2)
  }
  return () => {
    return //...
  }
}
```
当使用该组件时，我们可以监听由 emit 函数发射的自定义事件：

```html
<MyComponent @change='handler' />
```

上面这段模板对应的虚拟 DOM 为：

```js
const CompVNode = {
  type: MyComponent,
  props: {
    onChange: handler
  }
}
```

发射自定义事件的本质就是根据事件名称去 props 数据对象中寻找对应的事件处理函数并执：

```js
export function mountComponent(vnode, container, anchor, patch) {
  // 省略其他代码

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

  // NOTE 关于 emit 相关的实现
  /**
   * emit 函数
   * @param {*} event 事件名称
   * @param  {...any} payload 传递给事件函数的参数
   */
  function emit(event, ...payload) {
    // 根据约定对事件名进行处理，例如 change => onChange
    const eventName = `on${event[0].toUpperCase() + event.slice(1)}`
    // 根据处理后的事件名称去props中寻找对应的事件处理函数
    const handler = instance.props[eventName]
    if (handler) {
      // 调用事件处理函数并传递参数
      handler(...payload)
    } else {
      console.error('事件不存在')
    }
  }

  // NOTE 关于 setup 相关的实现

  // setupContext，由于还没有涉及到 slots，所以暂时只需要 attrs emit
  const setupContext = { attrs, emit }

  // 省略其他代码
}

```

只需要实现一个 emit 函数并将其添加到 setupContext 对象中，这样用户就可以通过 setupContext 取得 emit 函数了。

这里有一点需要额外注意，我们在讲解 props 时提到，任何没有显式地声明为 props 的属性都会存储到 attrs 中。换句话说，任何事件类型的 props，即 onXxx 类的属性，都不会出现在props 中。这导致我们无法根据事件名称在 instance.props 中找到对应的事件处理函数。为了解决这个问题，我们需要在解析 props 数据的时候对事件类型的 props 做特殊处理：

```js
// 用于解析组件 props 和 attrs 数据
export function resolveProps(options, propsData) {
  const props = {}
  const attrs = {}

  // 遍历为组件传递的 props 数据
  for (const key in propsData) {

    if (key in options || key.startsWith('on')) {
      // 如果为组件传递的 props 数据在组件自身的 props 选项中有定义，则将其视为合法的props
      // 并且，以字符串on开头的props，无论是否显示的声明，都将添加到props数据中，而不是添加到attrs中
      props[key] = propsData[key]
    } else {
      // 否则作为 attrs
      attrs[key] = propsData[key]
    }
  }
  // 最后返回props和attrs
  return [props, attrs]
}

```
处理方式很简单，通过检测 propsData 的 key 值来判断它是否以字符串 'on' 开头，如果是，则认为该属性是组件的自定义事件。这时，即使组件没有显式地将其声明为 props，我们也将它添加到最终解析的 props 数据对象中，而不是添加到 attrs 对象中。

## 7. 插槽的工作原理和实现

顾名思义，组件的插槽指组件会预留一个槽位，该槽位具体要渲染的内容由用户插入，如下面给出的MyComponent 组件的模板所示：

```html
<template>
  <handler>
    <slot name="header" />
  </handler>
  <div>
    <slot name="body" />
  </div>
  <footer>
    <slot name="footer" />
  </footer>
</template>
```

当在父组件中使用 <MyComponent> 组件时，可以根据插槽的名字来插入自定义的内容：

```html
<MyComponent>
  <template #header>
    <h1>我是标题</h1>
  </template>
  <template #body>
    <section>我是内容</section>
  </template>
  <template #footer>
    <p>我是注脚</p>
  </template>
</MyComponent>
```

上面这段父组件的模板会被编译成如下渲染函数：

```js
function render() {
  return {
    type: MyComponent,
    children: {
      header() {
        return {type: 'h1', children: '我是标题'}
      }，
      body() {
        return {type: 'section', children: '我是内容'}
      }，
      footer() {
        return {type: 'p', children: '我是注脚'}
      }
    }
  }
}
```

可以看到，组件模板中的插槽内容会被编译为插槽函数，而插槽函数的返回值就是具体的插槽内容。组件 MyComponent 的模板则会被编译为如下渲染函数：

```js
// MyComponent 组件模板的编译结果
function render() {
  return [
    {
      type: 'header',
      children: [this.$slots.header()]
    },
    {
      type: 'body',
      children: [this.$slots.body()]
    },
    {
      type: 'footer',
      children: [this.$slots.footer()]
    }
  ]
}
```

在运行时的实现上，插槽则依赖于 setupContext 中的 slots 对象，如下面的代码所示：

```js
export function mountComponent(vnode, container, anchor, patch) {
  // 省略其他代码

  // NOTE 关于 slots 相关的实现
  // 直接将编译好的 vnode.children 对象作为 slots 对象即可
  const slots = vnode.children || {}

  // 定义组件实例，一个组件实例本质上就是一个对象，它包含与组件有关的状态选项
  const instance = {
    // 组件自身的状态数据，即data
    state,
    // 解析出的 props 数据包装为 shallowReactive 并定义到组件实例上
    props: shallowReactive(props),
    // 一个布尔值，用来表示组件是否已经别挂载，初始值为false
    isMounted: false,
    // 组件所渲染的内容，即子树（subTree）
    subTree: null,
    // 将插槽添加到组件实例上
    slots
  }

  // 省略其他代码

  const setupContext = { attrs, emit, slots }

  // 省略其他代码
}

```

可以看到，最基本的 slots 的实现非常简单。只需要将编译好的 vnode.children 作为 slots 对象，然后将 slots 对象添加到 setupContext 对象中。为了在 render 函数内和生命周期钩子函数内能够通过 this.$slots 来访问插槽内容，我们还需要在 renderContext 中特殊对待 $slots 属性，如下面的代码所示：

```js
// 创建渲染上下文对象，本质上是组件实例的代理
const renderContext = new Proxy(instance, {
  get(t, k, r) {
    // 取得组件自身状态与 props 数据
    const { state, props, slots } = t
    // 当k的值为 $slots 时，直接返回组件实例的slots
    if (k === '$slots') return slots
    if (state && k in state) {
      return state[k]
    } else if (k in props) {
      // 如果组件自身没有该数据，则尝试从props 中读取
      return props[k]
    } else if (setupState && k in setupState) {
      // 渲染上下文需要增加对 setupState 的支持
      return setupState[k]
    } else {
      console.error('不存在')
    }
  },
  // 省略其他代码
})
```

我们对渲染上下文 renderContext 代理对象的 get 拦截函数做了特殊处理，当读取的键是 `$slots` 时，直接返回组件实例上的 slots 对象，这样用户就可以通过 `this.$slots` 来访问插槽内容了。

## 8. 注册生命周期

在 A 组件的 setup 函数中调用 onMounted 函数会将该钩子函数注册到 A 组件上；而在 B 组件的setup 函数中调用 onMounted 函数会将钩子函数注册到 B 组件上，这是如何实现的呢？实际上，我们需要维护一个变量 currentInstance，用它来存储当前组件实例，每当初始化组件并执行组件的setup 函数之前，先将 currentInstance 设置为当前组件实例，再执行组件的 setup 函数，这样我们就可以通过 currentInstance 来获取当前正在被初始化的组件实例，从而将那些通过 onMounted 函数注册的钩子函数与组件实例进行关联。

我们需要在组件实例对象上添加 instance.mounted 数组。之所以 instance.mounted 的数据类型是数组，是因为在 setup 函数中，可以多次调用 onMounted 函数来注册不同的生命周期函数，这些生命周期函数都会存储在 instance.mounted 数组中。

只需要通过 currentInstance 取得当前组件实例，并将生命周期钩子函数添加到当前实例对象的 instance.mounted 数组中即可。另外，如果当前实例不存在，则说明用户没有在 setup 函数内调用 onMounted 函数，这是错误的用法，因此我们应该抛出错误及其原因。

最后一步需要做的是，在合适的时机调用这些注册到 instance.mounted 数组中的生命周期钩子函数，如下面的代码所示：

```js
import { queueJob } from "./queueJob.js"
const { reactive, effect, shallowReactive, shallowReadonly } = VueReactivity



// 全局变量，存储当前正在被初始化的组件实例
let currentInstance = null
// 该方法接收组件实例作为参数，并将该实例设为 currentInstance
function setCurrentInstance(instance) {
  currentInstance = instance
}

export function onMounted(fn) {
  if (currentInstance) {
    currentInstance.mounted.push(fn)
  } else {
    console.error('onMounted 函数只能在 setup 中调用')
  }
}

export function mountComponent(vnode, container, anchor, patch) {
  // 忽略部分代码

  // 定义组件实例，一个组件实例本质上就是一个对象，它包含与组件有关的状态选项
  const instance = {
    // 组件自身的状态数据，即data
    state,
    // 解析出的 props 数据包装为 shallowReactive 并定义到组件实例上
    props: shallowReactive(props),
    // 一个布尔值，用来表示组件是否已经别挂载，初始值为false
    isMounted: false,
    // 组件所渲染的内容，即子树（subTree）
    subTree: null,
    // 将插槽添加到组件实例上
    slots,
    // 在组件实例中添加 mounted 数组，用来存储通过onMounted 函数注册的生命周期钩子函数
    mounted: []
  }



  // 忽略部分代码

  // setupContext
  const setupContext = { attrs, emit, slots }

  // 在调用setup函数之前，设置当前组件实例
  setCurrentInstance(instance)
  // 调用setup函数，将只读版本的 props 作为第一个参数传递，避免用户修改props值
  // 将 setupContext 作为第二个参数传递
  const setupResult = setup(shallowReadonly(instance.props), setupContext)
  // 在setup函数执行完毕后，重置当前组件的实例
  setCurrentInstance(null)

  // 忽略部分代码

  // 将组件的 render 函数调用包装到 effect 内
  effect(() => {
    // 调用render函数时，将其this指向state，从而在render函数内部可以通过this访问组件自身状态数据
    const subTree = render.call(state, state)
    // 检查组件是否已经被挂载
    if (!instance.isMounted) {
      // 忽略部分代码

      // 在这里调用 mounted 钩子
      mounted && mounted.call(state)

      // 遍历 instance.mounted数组，并逐个执行即可
      instance.mounted && instance.mounted.forEach(hook => hook.call(renderContext))
    } else {
      // 忽略部分代码
    }
    // 更新组件实例的子树
    instance.subTree = subTree

  }, {
    scheduler: queueJob
  })
}

// 忽略部分代码

```


可以看到，我们只需要在合适的时机遍历 instance.mounted 数组，并逐个执行该数组内的生命周期钩子函数即可。

对于除 mounted 以外的生命周期钩子函数，其原理同上。
