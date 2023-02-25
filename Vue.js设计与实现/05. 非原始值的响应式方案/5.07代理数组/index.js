import { reactive, shallowReactive } from "./createReactive.js";
import { effect } from "./effect.js";
import { computed } from "./computed.js";
import { watch } from './watch.js'

/* const data = {
  foo: {
    bar: 1
  },
  hoo: 2
}

const p = reactive(data) //深响应
// const p = shallowReactive(data) // 浅响应

const comp = computed(() => p.foo.bar + p.hoo)

watch(p, (newVal, oldVal) => {
  console.log('监听到了变化', newVal, oldVal)
}, {
  immediate: true
})

effect(() => {
  document.body.innerText = comp.value
})

setTimeout(() => {
  p.foo.bar++
}, 5000) */

/* const obj = {}
const arr = reactive([obj])
console.log(arr.includes(arr[0])) // true */


/* const obj = {}
const arr = reactive([obj])
console.log(arr.includes(obj)) // true */

const arr = reactive([])

// 第一个副作用函数
effect(() => {
  arr.push('a')
})


/* // 第二个副作用函数
effect(() => {
  arr.push(1)
})
 */
console.log('arr', arr)
