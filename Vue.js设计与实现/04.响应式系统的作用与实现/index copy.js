// 存储副作用函数的桶
const bucket = new Set()

// 原始数据
const data = { text: 'hello world' }

const obj = new Proxy(data, {
  get(target, key) {
    // 将 activeEffect 添加到存储副作用函数的桶中
    if (activeEffect) {
      bucket.add(activeEffect)
    }
    return target[key]
  },
  set(target, key, newVal) {
    target[key] = newVal
    bucket.forEach(fn => fn())
    return true
  }
})

// TODO:实现一个注册副作用函数的机制
// 用一个全局变量存储被逐出的副作用函数
let activeEffect

// effect 函数用于注册副作用函数，将副作用函数 fn 赋值给 activeEffect
function effect(fn) {
  activeEffect = fn
  // 执行副作用函数
  fn()
}


effect(() => {
  console.log('effect run')
  document.body.innerHTML = obj.text
})

setTimeout(() => {
  obj.notExist = 'hello vue3'
}, 1000)

