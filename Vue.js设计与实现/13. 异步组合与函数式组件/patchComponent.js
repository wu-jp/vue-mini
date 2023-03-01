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
