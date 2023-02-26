import { reactive, shallowReactive } from "./createReactive.js";
import { effect } from "./effect.js";
import { computed } from "./computed.js";
import { watch } from './watch.js'
import { ref, toRef, toRefs } from './ref.js'



/* const foo = ref(0)
effect(() => {
  console.log('触发响应', foo.value)
})

foo.value = 1 */


/* const obj = reactive({ foo: 1, bar: 2 })
const fooRef = toRef(obj, 'foo')
effect(() => {
  console.log('触发响应', fooRef.value)
})

obj.foo = 100 // 改变源数据，会触发响应 */


const obj = reactive({ foo: 1, bar: 2 })
const objAsRef = toRefs(obj)
effect(() => {
  console.log('触发响应', objAsRef.foo.value)
})

obj.foo = 100 // 改变源数据，会触发响应

