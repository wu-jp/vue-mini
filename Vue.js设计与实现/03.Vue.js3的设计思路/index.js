const vnode = {
  tag: 'div',
  props: {
    onClick: () => alert('hello')
  },
  children: 'click me'
}

function mountElement(vnode, container) {
  // 使用 vnode.tag 作为标签名创建DOM元素
  const el = document.createElement(vnode.tag)
  // 遍历 vnode.props，将属性、事件添加到 DOM 元素
  for (const key in vnode.props) {
    if (/^on/.test(key)) {
      // 如果 key 以 on 开头，说明它是事件
      el.addEventListener(
        key.substr(2).toLocaleLowerCase(),// 事件名称 onClick ---> click
        vnode.props[key] // 事件处理函数
      )
    }
  }

  // 处理children
  if (typeof vnode.children === 'string') {
    // 如果 children 是字符串，说明它是元素的文本子节点
    el.appendChild(document.createTextNode(vnode.children))
  } else if (Array.isArray(vnode.children)) {
    // 递归地调用 renderer 函数渲染子节点，使用当前元素 el 作为挂载点
    vnode.children.forEach(child => renderer(child, el))
  }

  // 将元素添加到挂载点下
  container.appendChild(el)
}

function mountComponent(vnode, container) {
  let subtree;
  if (typeof vnode.tag === 'function') {
    // 调用组件函数，获取组件函数需要渲染的内容（虚拟 DOM ）
    subtree = vnode.tag()
  } else if (typeof vnode.tag === 'object') {
    // tag是组件对象，调用它的 render 函数，获取组件需要渲染的内容（虚拟 DOM ）
    subtree = vnode.tag.render()
  }

  // 递归调用 renderer 渲染 subtree
  renderer(subtree, container)
}

/**
 *
 * @param {*} vnode 虚拟DOM对象
 * @param {*} container 一个真实的DOM，作为挂载点，渲染器会把虚拟DOM挂载到该元素下。
 */
function renderer(vnode, container) {
  if (typeof vnode.tag === 'string') {
    // 说明vnode描述的是一个标签元素
    mountElement(vnode, container)
  } else if (typeof vnode.tag === 'function') {
    // 说明 vnode 描述的是一个组件
    mountComponent(vnode, container)
  } else if (typeof vnode.tag === 'object') {
    // 说明 vnode 描述的是一个组件
    mountComponent(vnode, container)
  }
}

// body 作为挂载点
renderer(vnode, document.body)
