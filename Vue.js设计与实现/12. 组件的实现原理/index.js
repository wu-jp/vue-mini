import { createRenderer, APIOptions } from "./render.js"

const { effect, ref } = VueReactivity // 通过 script 标签导入 vue3 响应式的包

const MyComponent = {
  name: 'MyComponent',
  props: {
    titles: String
  },
  data() {
    return {
      foo: 'hello world'
    }
  },
  render() {
    return {
      type: 'div',
      children: `我是一个文本 ${this.titles}`
    }
  }
}

const CompVNode = {
  type: MyComponent,
  props: {
    titles: 'a big Title',
    other: this.foo
  }
}

// <MyComponent titles="a big Title" :other="foo"></MyComponent>


const render = createRenderer(APIOptions)
render(CompVNode, document.querySelector('#app'))
