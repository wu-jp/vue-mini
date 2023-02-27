function patchKeyedChildren(n1, n2, container) {
  const oldChildren = n1.children
  const newChildren = n2.children

  // 创建四个索引
  let oldStartIdx = 0
  let oldEndIdx = oldChildren.length - 1
  let newStartIdx = 0
  let newEndIdx = newChildren.length - 1

  // 四个索引指向的 vnode 节点
  let oldStartVNode = oldChildren[oldStartIdx]
  let oldEndVNode = oldChildren[oldEndIdx]
  let newStartVNode = newChildren[newStartIdx]
  let newEndVNode = newChildren[newEndIdx]

  while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
    // 如果头尾节点为undefined，这说明该节点被处理过了，直接跳到下一个位置
    if (!oldStartVNode) {
      oldStartVNode = oldChildren[++oldStartIdx]
    } else if (!oldEndVNode) {
      oldEndVNode = oldChildren[--oldEndIdx]
    } else if (oldStartVNode.key === newStartVNode.key) {
      // 第一步：oldStartVNode 和 newStartVNode 比较
      // 打补丁
      patch(oldStartVNode, newStartVNode, container)
      // 指向下一个位置
      oldStartVNode = oldChildren[++oldStartIdx]
      newStartVNode = oldChildren[++newStartIdx]
    } else if (oldEndVNode.key === newEndVNode.key) {
      // 第二部：oldEndVNode 和 newEndVNode 比较
      // 都属于尾部，不需要移动，但是需要打补丁
      patch(oldEndVNode, newEndVNode, container)
      // 更新索引和头尾部变量
      oldEndVNode = oldChildren[--oldEndIdx]
      newEndVNode = newChildren[--newEndIdx]
    } else if (oldStartVNode.key === newEndVNode.key) {
      // 第三步：oldStartVNode 和 newEndVNode 比较
      // 打补丁
      patch(oldStartVNode, newEndVNode, container)
      // 将旧的一组子节点的对应的真实 DOM 节点 oldStartVNode.el 移动到旧的一组子节点的尾部节点对应的真实 DOM 节点后面
      insert(oldStartVNode.el, container, oldEndVNode.el.nextSibling)
      // 更新相关索引到下一个位置
      oldStartVNode = oldChildren[++oldStartIdx]
      newEndVNode = newChildren[--newEndIdx]
    } else if (oldEndVNode.key === newStartVNode.key) {
      // 第四步：oldEndVNode 和 newStartVNode 比较
      // 调用 patch 函数进行打补丁
      patch(oldEndVNode, newStartVNode, container)
      // 移动 DOM 操作，oldEndVNode.el 移动到 oldStartVNode.el 前面
      insert(oldEndVNode.el, container, oldStartVNode.el)
      // 移动完成后，更新索引，并指向下一个位置
      oldEndVNode = oldChildren[--oldEndIdx]
      newStartVNode = newChildren[++newStartIdx]
    } else {
      // 遍历旧的 children，视图寻找到与 newStartVNode 相同的 key 值的元素
      const idxInOld = oldChildren.findIndex(node => node.key === newStartVNode.key)

      // idxInOld 大于0，说明找到了可复用的节点，并且需要将其对应的真实DOM移动到头部
      if (idxInOld > 0) {
        // idxInOld 位置对应的 vnode 就是需要移动的节点
        const vnodeToMove = oldChildren[idxInOld]
        patch(vnodeToMove, newStartVNode, container)
        // 将 vnodeToMove.el 移动到头部节点 oldStartVNode.el 之前，因此使用后者作为锚点
        insert(vnodeToMove.el, container, oldStartVNode.el)
        // 由于位置 idxInOld 处的节点对应的真实DOM已经移动到别处了，因此设置为 undefined
        oldChildren[idxInOld] = undefined
      } else {
        // 将 newStartVNode 作为 最新的节点过载到头部，使用当前头部节点 oldStartVNode.el 作为锚点
        patch(null, newStartVNode, container, oldStartVNode.el)
      }
      // 最后更新 newStartIdx 到下一个位置
      newStartVNode = newChildren[++newStartIdx]
    }
  }

  // 循环结束后检查索引的情况
  if (oldEndIdx < oldStartIdx && newStartIdx <= newEndIdx) {
    // 如果满足条件，则说明有新的节点被遗留，需要挂载它们
    for (let i = newStartIdx; i <= newEndIdx; i++) {
      patch(null, newChildren[i], container, oldStartVNode.el)
    }
  } else if (newEndIdx < newStartIdx && oldStartIdx <= oldEndIdx) {
    // 移除操作
    for (let i = oldStartIdx; i <= oldEndIdx; i++) {
      unmount(oldChildren[i])
    }
  }
}
