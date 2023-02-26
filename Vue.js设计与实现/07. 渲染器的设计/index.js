const { effect, ref } = VueReactivity

// 创建渲染器函数
function createRenderer(options) {
  // 通过 options 得到操作 DOM 的 API
  const {
    createElement,
    insert,
    setElementText
  } = options

  function render(vnode, container) {
    if (vnode) {
      // 如果vnode存在，将它和 旧的vnode 一起传给 patch 函数时，进行打补丁
      patch(container._vnode, vnode, container)
    } else {
      if (container._vnode) {
        // 旧 vnode 存在，且新的不存在，说明是卸载操作（unmount）
        // 只需要将 container 内的 DOM 清除即可
        container.innerHTML = ''
      }
    }
    // 把 vnode 存储到 container._vnode 下，即后续渲染中的旧 vnode
    container._vnode = vnode
  }

  /**
   * patch函数是整个渲染器的核心入口，它承载了最重要的渲染逻辑。
   * @param {*} n1 旧 vnode
   * @param {*} n2 新 vnode
   * @param {*} container 容器
   */
  function patch(n1, n2, container) {
    if (!n1) {
      // n1不存在，意味着挂载，则调用 mountElement 函数完成挂载
      mountElement(n2, container)
    } else {
      // n1存在，意味着补丁，暂时忽略
    }
  }

  /**
   * 挂载函数
   * @param {*} vnode 挂载的虚拟dom
   * @param {*} container 容器
   */
  function mountElement(vnode, container) {
    // 创建DOM元素
    const el = createElement(vnode.type)

    // 处理子节点，如果子节点是字符串，代表元素具有文本节点
    if (typeof vnode.children === 'string') {
      // 设置元素的 textContent 属性即可
      setElementText(el, vnode.children)
    }

    // 将元素添加到容器中
    insert(el, container)
  }

  return render
}

const vnode = {
  type: 'h1',
  children: 'hello'
}

// 在创建 renderer时传入配置项 （操作 DOM 的配置）
// 只要传入不同的配置项，就能够完成非浏览器环境下的渲染工作。
const render = createRenderer({
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
  }
})

render(vnode, document.querySelector('#app'))





