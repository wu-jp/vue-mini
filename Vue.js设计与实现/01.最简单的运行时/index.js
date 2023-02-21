// 前端框架的一般有三种：
// 纯运行时（Jquery）、编译时（Svelte）、运行时+编译时（Vue、React）

// 下面是纯运行时的思路：
const obj = {
  tag: 'div',
  children: [
    {
      tag: 'span',
      children: 'hello world'
    }
  ]
}

function Render(obj, root) {
  const el = document.createElement(obj.tag)
  if (typeof obj.children === 'string') {
    const text = document.createTextNode(obj.children)
    el.appendChild(text)
  } else if (obj.children) {
    // 数组 递归调用render
    obj.children.forEach(child => Render(child, el))
  }

  root.appendChild(el)
}

Render(obj, document.body)
