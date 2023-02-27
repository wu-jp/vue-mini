function patchChildren(n1, n2, container) {
  if (Array.isArray(n2.children)) {
    const oldChildren = n1.children
    const newChildren = n2.children

    const oldLen = oldChildren.length
    const newLen = oldChildren.length

    const commonLength = Math.min(oldLen, newLen)

    // 更新子节点
    for (let i = 0; i < commonLength; i++) {
      patch(oldChildren[i], newChildren[i], container)
    }

    // 如果新子节点的数量更多，有新的子节点需要挂载
    if (newLen > oldLen) {
      for (let i = commonLength; i < newLen; i++) {
        patch(null, newChildren(i), container)
      }
    } else if (oldLen > newLen) {
      // 说明有旧的子节点需要卸载
      for (let i = commonLength; i < oldLen; i++) {
        unmount(oldChildren[i])
      }
    }
  }
}
