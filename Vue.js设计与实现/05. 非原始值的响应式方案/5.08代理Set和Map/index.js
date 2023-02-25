import { reactive, shallowReactive } from "./createReactive.js";
import { effect } from "./effect.js";
import { computed } from "./computed.js";
import { watch } from './watch.js'

const p = reactive(new Set([1, 2, 3]))
console.log(p.size) // 3
