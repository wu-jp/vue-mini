interface vnode {
  type: string
  children: vnode[]
  key: number
}

function patchChildren1 (n1: vnode, n2: vnode, container) {
  if(Array.isArray(n2.children)) {
    const oldChildren = n1.children
    const newChildren = n2.children

    // 用来存储寻找过程中遇到的最大索引值
    let lastIndex: number = 0

    for(let i = 0; i < newChildren.length; i++) {
      const newVNode = newChildren[i]

      for (let j = 0; j < oldChildren.length; j++) {
        const oldVNode = oldChildren[j]

        if(newVNode.key === oldVNode.key) {
          patch(oldVNode, newVNode, container)

          if(j < lastIndex) {
            // 如果当前找到的节点在旧 children 中的索引小于最大索引值 lastIndex
            // 说明该节点对应的真实DOM需要移动
            // TODO move
          }else {
            // 如果当前找到的节点在旧 children 中的索引不小于最大索引值，则更新 lastIndex 的值
            lastIndex = j
          }
        }

        break
      }
    }
  }
}

function patch(n1, n2, container) {}
