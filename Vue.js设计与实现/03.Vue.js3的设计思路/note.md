# Vue.js 3 的设计思路

## 声明式的描述UI

前端页面涉及到那些内容？

- DOM元素
- 属性
- 事件
- 元素的层级结构

如果声明式描述上面的内容呢？

- 使用和html标签一致的方式来描述dom元素，例如描述一个 div 标签时可以使用 `<div></div>`
- 使用和html标签一致的方式来描述属性，例如 `<div id="app"></div>`
- 使用 : 或 v-bind 来描述动态绑定的属性，例如 `<div :id="dynamicId"></div>`
- 使用 @ 或 v-on 来描述事件，例如点击事件 `<div @click="handler"></div>`
- 使用与 HTML 标签一致的方式来描述层级结构，例如一个具有 span 子节点的 div 标签 `<div><span></span></div>`


除了使用模板来声明描述UI之外，还可以使用JavaScript对象来描述：
```js
const title = {
  // 标签名称
  tag: 'h1',
  // 标签属性
  props: {
    onClick: handler
  },
  // 子节点
  children: [
    { tag: 'span' }
  ]
}
```
对于的vue.js 模板就是：
```html
<h1 @click="handler"><span></span></h1>
```

这样看来，显然式js对象描述更加灵活。通过JS来描述UI的方式，其实就是所谓的虚拟DOM。

渲染函数：一个组件要渲染的内容是通过渲染函数来描述的，也就是下面代码中的render函数，Vue.js 会根据组件的render函数的返回值拿到虚拟DOM，然后就可以把组件的内容渲染出来了。
```js
export default {
  render() {
    return {
      tag: 'h1',
      props: { onClick: handler }
    }
  }
}
```

## 初识渲染器

我们已经知道，其实虚拟DOM就是用JavaScript对象俩描述真实DOM的结构。那么怎么将虚拟DOM渲染到浏览器页面中呢？这里就用到了：渲染器。

假设有如下的虚拟DOM:
```js
const vnode = {
  tag: 'div',
  props: {
    onClick: () => alert('hello')
  },
  children: 'click me'
}
```
首先简单解释一下上面这段代码。
- tag 用来描述标签名称，所以 tag: 'div' 描述的就是一个 `<div>` 标签。
- props 是一个对象，用来描述 `<div>` 标签的属性、事件等内容。可以看到，我们希望给 div 绑定一个点击事件。
- children 用来描述标签的子节点。在上面的代码中，children 是一个字符串值，意思是 div 标签有一个文本子节点：`<div>click me</div>`

接下来需要编写一个渲染器，把虚拟DOM渲染为真实DOM:
```js
const vnode = {
  tag: 'div',
  props: {
    onClick: () => alert('hello')
  },
  children: 'click me'
}

/**
 *
 * @param {*} vnode 虚拟DOM对象
 * @param {*} container 一个真实的DOM，作为挂载点，渲染器会把虚拟DOM挂载到该元素下。
 */
function renderer(vnode, container) {
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

// body 作为挂载点
renderer(vnode, document.body)
```

总结分为三步：
- 创建元素：把 vnode.tag 作为标签名称来创建 DOM 元素。
- 为元素添加属性和事件：遍历 vnode.props 对象，如果key 以 on 字符开头，说明它是一个事件，把字符 on 截取掉后再调用 toLowerCase 函数将事件名称小写化，最终得到合法的事件名称，例如 onClick 会变成 click，最后调用addEventListener 绑定事件处理函数。
- 处理 children：如果 children 是一个数组，就递归地调用renderer 继续渲染，注意，此时我们要把刚刚创建的元素作为挂载点（父节点）；如果 children 是字符串，则使用createTextNode 函数创建一个文本节点，并将其添加到新创建的元素内。

以上仅仅只是做了创建节点，渲染器的精髓都在更新节点的阶段。

我们对vnode做一点小的修改：
```js
const vnode = {
  tag: 'div',
  props: {
    onClick: () => alert('hello')
  },
  children: 'click again' // 从 me 改成 again
}
```

对于渲染器来说，它需要精确地找到 vnode 对象的变更点并且只更新变更的内容。就上例来说，渲染器应该只更新元素的文本内容，而不需要再走一遍完整的创建元素的流程。这些内容后文会重点讲解，但无论如何，希望大家明白，渲染器的工作原理其实很简单，归根结底，都是使用一些我们熟悉的DOM 操作 API 来完成渲染工作。

## 组件的本质

