const KeepAlive = {
  // KeepAlive 组件独有的属性，用作标识
  _isKeepAlive: true,
  setup(props, { slots }) {
    const cache = new Map()

    const instance = currentInstance

    const { move, createElement } = instance.KeepAliveCtx

    const storageContainer = createElement('div')

    instance._deActivate = (vnode) => {
      move(vnode, storageContainer)
    }

    instance._activate = (vnode, container, anchor) => {
      move(vnode, container, anchor)
    }

    return () => {
      let rawVNode = slots.default()

      if (typeof rawVNode.type !== 'object') {
        return rawVNode
      }

      // 获取组件内部的name
      const name = rawVNode.type.name
      // 如果 name 无法被 include 匹配或者被 exclude 匹配
      if (name && (
        (props.include && !props.include.test(name)) || (props.exclude && props.exclude.test(name))
      )) {
        // 则直接渲染内部组件，不对其进行后续的缓存操作
        return rawVNode
      }

      const cachedVNode = cache.get(rawVNode.type)
      if (cachedVNode) {
        rawVNode.component = cachedVNode.component
        rawVNode.KeepAlive = true
      } else {
        cache.set(rawVNode.type, rawVNode)
      }

      rawVNode.shouldKeepAlive = true

      rawVNode.KeepAliveInstance = instance

      return rawVNode
    }
  }
}
