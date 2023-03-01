import { queueJob } from "./queueJob.js"
const { reactive, effect, shallowReactive, shallowReadonly } = VueReactivity


/**
 * 挂载组件
 * @param {*} vnode 挂载的虚拟DOM组件
 * @param {*} container 容器
 * @param {*} anchor 锚点
 * @param {*} patch 补丁
 */
export function mountComponent(vnode, container, anchor, patch) {

  // 获取组件的配置对象，即 vnode.type
  const componentOptions = vnode.type

  // NOTE 处理函数式组件
  // 检查是否是函数式组件
  if (typeof vnode.type === 'function') {
    // 如果是函数式组件，则将 vnode.type 作为渲染函数，将vnode.type.props 作为 props 选项定义即可
    componentOptions = {
      render: vnode.type,
      props: vnode.type.props
    }
  }

  // 获取组件的渲染函数
  const { render, data, setup, props: propsOption, beforeCreate, created, beforeMount, mounted, beforeUpdate, updated } = componentOptions
  // 在这里调用 beforeCreate 钩子
  beforeCreate && beforeCreate()

  // 调用data函数得到原始数据，并调用reactive函数将其包装为响应式数据
  const state = reactive(data())

  // 调用 resolveProps 函数解析出最终的 props 数据与 attrs 数据
  const [props, attrs] = resolveProps(propsOption, vnode.props)

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
    slots,
    // 在组件实例中添加 mounted 数组，用来存储通过onMounted 函数注册的生命周期钩子函数
    mounted: []
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

  // setupContext
  const setupContext = { attrs, emit, slots }

  // 在调用setup函数之前，设置当前组件实例
  setCurrentInstance(instance)
  // 调用setup函数，将只读版本的 props 作为第一个参数传递，避免用户修改props值
  // 将 setupContext 作为第二个参数传递
  const setupResult = setup(shallowReadonly(instance.props), setupContext)
  // 在setup函数执行完毕后，重置当前组件的实例
  setCurrentInstance(null)

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

      // 遍历 instance.mounted数组，并逐个执行即可
      instance.mounted && instance.mounted.forEach(hook => hook.call(renderContext))
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

// 全局变量，存储当前正在被初始化的组件实例
let currentInstance = null
// 该方法接收组件实例作为参数，并将该实例设为 currentInstance
function setCurrentInstance(instance) {
  currentInstance = instance
}


function onMounted(fn) {
  if (currentInstance) {
    currentInstance.mounted.push(fn)
  } else {
    console.error('onMounted 函数只能在 setup 中调用')
  }
}
