const { effect, ref } = VueReactivity

// 创建渲染器函数
function createRenderer(options) {
  // 通过 options 得到操作 DOM 的 API
  const {
    createElement,
    insert,
    setElementText,
    patchProps
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
   * patch函数是整个渲染器的核心入口，它承载了最重要的渲染逻辑。
   * @param {*} n1 旧 vnode
   * @param {*} n2 新 vnode
   * @param {*} container 容器
   */
  function patch(n1, n2, container) {
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
        mountElement(n2, container)
      } else {
        // n1存在，意味着补丁
        patchElement(n1, n2)
      }
    } else if (typeof type === 'object') {
      // 如果n2的类型时一个对象，则它描述的是组件
    } else if (type === 'xxx') {
      // 处理其他类型的 vnode
    }
  }

  /**
   * 挂载函数
   * @param {*} vnode 挂载的虚拟dom
   * @param {*} container 容器
   */
  function mountElement(vnode, container) {
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
    insert(el, container)
  }

  // 补丁（更新DOM）
  function patchElement(n1, n2) { /* ... */ }

  /**
   * 卸载函数
   * @param {*} vnode 卸载的虚拟节点
   */
  function unmount(vnode) {
    const parent = vnode.el.parentNode
    if (parent) {
      parent.removeChild(vnode)
    }
  }

  return render
}

// 该函数会返回一个布尔值，代表属性是否应该作为 DOM Properties 被设置
function shouldSetAsProps(el, key, value) {
  // 特殊处理（这里以form属性为例，还有其他的就不一一写了）
  if (key === 'form' && el.tagName === 'INPUT') return false
  // 兜底， 用 in 操作符 判断 key 是否存在对应的 DOM Properties
  return key in el
}

// 用于处理多种class属性的设置，返回统一的字符串形式
function normalizeClass() { /* ... */ }

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
const vnode = {
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
  }
})

render(vnode, document.querySelector('#app'))





