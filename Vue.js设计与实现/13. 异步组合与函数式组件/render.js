import { mountComponent } from "./mountComponet.js"
import { patchComponent } from "./patchComponent.js"

// 创建渲染器函数
export function createRenderer(options) {
  // 通过 options 得到操作 DOM 的 API
  const {
    createElement,
    insert,
    setElementText,
    patchProps,
    createText,
    setText,
  } = options

  function render(vnode, container) {
    if (vnode) {
      // 如果vnode存在，将它和 旧的vnode 一起传给 patch 函数时，进行打补丁
      patch(container._vnode, vnode, container)
    } else {
      if (container._vnode) {
        // 旧 vnode 存在，且新的不存在，说明是卸载操作（unmount）
        // 只需要将 container 内的 DOM 清除即可
        unmount(container._vnode)
      }
    }
    // 把 vnode 存储到 container._vnode 下，即后续渲染中的旧 vnode
    container._vnode = vnode
  }

  /**
   * patch 函数是整个渲染器的核心入口，它承载了最重要的渲染逻辑。
   * @param {*} n1 旧 vnode
   * @param {*} n2 新 vnode
   * @param {*} container 容器
   * @param {*} anchor 锚点元素
   */
  function patch(n1, n2, container, anchor) {
    // 如果n1 存在，则对比 n1 和 n2 的类型
    if (n1 && n1.type !== n2.type) {
      // 如果新旧 vnode 的类型不同，则直接将旧 vnode 卸载
      unmount(n1)
      n1 = null
    }

    // 运行到这里说明，n1和n2的类型相同
    const { type } = n2

    if (typeof type === 'string') {
      if (!n1) {
        // n1不存在，意味着挂载，则调用 mountElement 函数完成挂载
        mountElement(n2, container, anchor)
      } else {
        // n1存在，意味着补丁
        patchElement(n1, n2)
      }
    } else if (typeof type === 'object' || typeof type === 'function') {
      // type 是对象 -->  有状态组件
      // type 是函数 -->  函数式组件

      // 如果n2的类型时一个对象，则它描述的是组件
      if (!n1) {
        // 挂载组件
        mountComponent(n2, container, anchor, patch)
      } else {
        // 更新组件
        patchComponent(n1, n2, anchor)
      }
    } else if (type === Text) {
      // 如果没有旧节点，则进行挂载
      if (!n1) {
        // 调用createText 函数创建文本节点
        const el = n2.el = createText(n2.children)
        // 将文本节点插入到容器中
        insert(el, container)
      } else {
        // 说明旧节点存在，只需要使用新文本节点的文本内容更新旧文本节点即可
        const el = n2.el = n1.el
        if (n2.children !== n1.children) {
          setText(el, n2.children)
        }
      }
    } else if (type === Fragment) {
      if (!n1) {
        // 如果旧节点不存在，则只需要将 Fragment 的 children 逐个挂载即可
        n2.children.forEach(c => patch(null, c, container))
      } else {
        // 如果旧节点存在，则只需要更新 Fragment 的 children 即可
        patchChildren(n1, n2, container)
      }
    }
  }

  /**
   * 挂载函数
   * @param {*} vnode 挂载的虚拟dom
   * @param {*} container 容器
   * @param {*} anchor 锚点元素
   */
  function mountElement(vnode, container, anchor) {
    // 创建DOM元素
    const el = vnode.el = createElement(vnode.type)

    // 处理子节点，如果子节点是字符串，代表元素具有文本节点
    if (typeof vnode.children === 'string') {
      // 设置元素的 textContent 属性即可
      setElementText(el, vnode.children)
    } else if (Array.isArray(vnode.children)) {
      // 如果 children 是数组，则遍历每一个子节点，并调用 patch 函数挂载他们
      vnode.children.forEach(child => {
        patch(null, child, el)
      })
    }

    if (vnode.props) {
      for (const key in vnode.props) {
        patchProps(el, key, null, vnode.props[key])
      }
    }

    // 将元素添加到容器中
    insert(el, container, anchor)
  }

  // 补丁（更新DOM）
  function patchElement(n1, n2) {
    const el = n2.el = n1.el
    const oldProps = n1.props
    const newProps = n2.props

    // 第一步：更新props
    for (const key in newProps) {
      if (newProps[key] !== oldProps[key]) {
        patchProps(el, key, oldProps[key], newProps[key])
      }
    }

    for (const key in oldProps) {
      if (!(key in newProps)) {
        patchProps(el, key, oldProps[key], null)
      }
    }

    // 第二步：更新 children
    patchChildren(n1, n2, el)
  }

  /**
   * 更新子节点
   * @param {*} n1
   * @param {*} n2
   * @param {*} container
   */
  function patchChildren(n1, n2, container) {
    if (typeof n2.children === 'string') {
      // 旧子节点的类型有三种可能：没有子节点、文本子节点、一组子节点
      // 只有当旧子节点为为一组子节点时，才需要逐个卸载，其他情况什么都不需要做
      if (Array.isArray(n1.children)) {
        n1.children.forEach(c => unmount(c))
      }

      // 最后将新的文本内容设置给容器元素
      setElementText(container, n2.children)
    }
    // 新子节点是一组子节点
    else if (Array.isArray(n2.children)) {
      // 判断旧子节点是否也是一组子节点
      if (Array.isArray(n1.children)) {
        // note 简单diff算法
        // patchKeyedSBChildren(n1, n2, container)

        // note 双端diff算法
        patchKeyedChildren(n1, n2, container)
      }
      // 旧子节点要么是文本，要么不存在
      else {
        // 无论哪种情况，我们都只需要将容器清空，然后将新的一组子节点组个挂载
        setElementText(container, '')
        n2.children.forEach(c => patch(null, c, container))
      }
    }
    // 新子节点不存在
    else {
      // 旧子节点是一组子节点，需要逐个卸载
      if (Array.isArray(n1.children)) {
        n1.children.forEach(c => c.unmount(c))
      }
      // 旧子节点是文本节点
      else if (typeof n1.children === 'string') {
        // 直接清空
        setElementText(container, '')
      }

      // 如果没有旧子节点，什么也不需要做
    }

  }

  // 简单diff算法
  function patchKeyedSBChildren(n1, n2, container) {
    const oldChildren = n1.children
    const newChildren = n2.children

    let lastIndex = 0

    for (let i = 0; i < newChildren.length; i++) {
      const newVNode = newChildren[i]
      let j = 0
      for (j; j < oldChildren.length; j++) {
        const oldVNode = oldChildren[j]

        if (newVNode.key === oldVNode.key) {
          patch(oldVNode, newVNode, container)

          if (j < lastIndex) {
            // 如果当前找到的节点在旧 children 中的索引小于最大索引值 lastIndex
            // 说明该节点对应的真实DOM需要移动

            // 获取 newVNode 的前一个vnode，即 pervVNode
            const pervVNode = newChildren[i - 1]

            // 如果 pervVNode 不存在，则说明当前 newVNode 是第一个节点，它不需要移动
            if (pervVNode) {
              // 我们要将 newVNode 对应的真实DOM移动到 PrevVNode 所对应的真实 DOM 后面
              // 所以需要获取 prevVnode 所对应真实DOM的下一个兄弟节点，并将其作为锚点
              const anchor = pervVNode.el.nextSibling
              // 调用 insert 方法将 newVNode 对应的真实 DOM 插入到锚点元素前面
              // 也就是 prevVNode 对应的真实 DOM 的后面
              insert(newVNode.el, container, anchor)
            }

          } else {
            // 如果当前找到的节点在旧 children 中的索引不小于最大索引值，则更新 lastIndex 的值
            lastIndex = j
          }

          break
        }
      }
    }

    // 移除不存在的元素
    for (let i = 0; i < oldChildren.length; i++) {
      const oldVNode = oldChildren[i]

      // 拿到旧子节点 oldVNode 去新的一组子节点中寻找具有相同 key 值的节点
      const has = newChildren.find(vnode => vnode.key === oldVNode.key)

      if (!has) {
        // 如果没有找到具有相同 key 值的节点，则说明需要删除该节点了
        // 调用unmount函数将其卸载
        unmount(oldVNode)
      }
    }
  }

  // 双端diff算法
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


  /**
   * 卸载函数
   * @param {*} vnode 卸载的虚拟节点
   */
  function unmount(vnode) {
    // 再卸载时，类型为 Fragment 的节点，需要依次卸载
    if (vnode.type === Fragment) {
      vnode.children.forEach(c => unmount(c))
      return
    } else if (typeof vnode.type === 'object') {
      // 对于组件的卸载，本质上是要卸载组件所渲染的内容，即 subTree 子树
      unmount(vnode.component.subTree)
    }

    const parent = vnode.el.parentNode
    if (parent) {
      parent.removeChild(vnode.el)
    }
  }

  return render
}

// 该函数会返回一个布尔值，代表属性是否应该作为 DOM Properties 被设置
export function shouldSetAsProps(el, key, value) {
  // 特殊处理（这里以form属性为例，还有其他的就不一一写了）
  if (key === 'form' && el.tagName === 'INPUT') return false
  // 兜底， 用 in 操作符 判断 key 是否存在对应的 DOM Properties
  return key in el
}

// 用于处理多种class属性的设置，返回统一的字符串形式
export function normalizeClass() { /* ... */ }


// 在创建 renderer时传入配置项 （操作 DOM 的配置）
// 只要传入不同的配置项，就能够完成非浏览器环境下的渲染工作。
export const APIOptions = {
  // 用于创建元素
  createElement(tag) {
    return document.createElement(tag)
  },
  // 用于设置元素的文本节点
  setElementText(el, text) {
    el.textContent = text
  },
  // 用于在给定的 parent 下添加指定元素
  insert(el, parent, anchor = null) {
    parent.insertBefore(el, anchor)
  },
  // 用于将属性设置相关操作封装到该函数中，并作为参数传递
  patchProps(el, key, prevValue, nextValue) {
    if (/^on/.test(key)) {
      // 定义 el._vei 为一个对象，存储事件名称和事件处理函数的映射
      const invokers = el._vei || (el._vei = {})
      // 获取为该元素伪造的事件处理函数 invoker
      let invoker = invokers[key]
      const name = key.slice(2).toLowerCase()

      if (nextValue) {
        if (!invoker) {
          // 如果没有invoker，则将一个伪造的invoker缓存到el._vei[key]中，vei是 vue event invoker的首字母缩写

          // 将事件处理函数缓存到 el._vei[key] 下，避免覆盖
          invoker = el._vei[key] = (e) => {
            // e.timeStamp 为事件发生的时间
            // 如果事件发生时间早于事件处理函数绑定的时间，则不执行事件处理函数
            if (e.timeStamp < invoker.attached) return
            // 如果 invoker.value 是数组，则遍历它并逐个调用事件处理函数
            if (Array.isArray(invoker.value)) {
              invoker.value.forEach(fn => fn(e))
            } else {
              // 否则直接作为函数调用
              invoker.value(e)
            }
          }

          // 将真在的事件处理函数赋值给 invoker.value
          invoker.value = nextValue
          // 添加invoker.attached属性，存储事件处理函数被绑定的时间。
          invoker.attached = performance.now()
          // 绑定 invoker 最为事件处理函数
          el.addEventListener(name, invoker)
        } else {
          // 如果 invoker 存在，意味着更新，并且只需要更新invoker.value的值即可
          invoker.value = nextValue
        }
      } else if (invoker) {
        // 新的事件绑定函数不存在，且之前绑定的invoker存在，则移除绑定
        el.removeEventListener(name, invoker)
      }
    }
    else if (key === 'class') {
      el.className = nextValue || ''
    }
    // 使用 shouldSetAsProps 函数判断是否作用 DOM Properties 设置
    else if (shouldSetAsProps(el, key, nextValue)) {
      // 获取 DOM Properties 的类型
      const type = typeof el[key]

      // 如果是布尔类型，并且value 是空字符串，将矫正为true
      if (type === 'boolean' && value === '') {
        el[key] = true
      } else {
        el[key] = nextValue
      }
    } else {
      // 如果设置的值没有对应的 DOM Properties，则使用 setAttribute 函数设置属性
      el.setAttribute(key, nextValue)
    }
  },
  createText(text) {
    return document.createTextNode(text)
  },
  setText(el, text) {
    el.nodeValue = text
  }
}


/* const vnode = {
  type: 'div',
  props: {
    id: 'foo',
    // class: normalizeClass([{ baz: true }])
    // class: normalizeClass(['foo baz']),
    onClick: () => {
      alert('hello click')
    }
  },
  children: [
    {
      type: 'p',
      children: 'hello'
    }
  ]
} */

/* const vnode = {
  type: 'p',
  props: {
    onClick: [
      // 第一个事件处理函数
      () => {
        alert('hello')
      },
      // 第二个事件处理函数
      () => {
        alert('world')
      }
    ],
    onContextmenu: () => {
      alert('contextmenu')
    }
  },
  children: 'text'
} */

/* const render = createRenderer(APIOptions)
render(vnode, document.querySelector('#app')) */





