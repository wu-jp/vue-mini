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

// 用于解析组件 props 和 attrs 数据
export function resolveProps(options, propsData) {
  const props = {}
  const attrs = {}

  // 遍历为组件传递的 props 数据
  for (const key in propsData) {
    if (key in options) {
      // 如果为组件传递的 props 数据在组件自身的 props 选项中有定义，则将其视为合法的props
      props[key] = propsData[key]
    } else {
      // 否则作为 attrs
      attrs[key] = propsData[key]
    }
  }
  // 最后返回props和attrs
  return [props, attrs]
}
