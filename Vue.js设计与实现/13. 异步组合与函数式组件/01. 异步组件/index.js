function defineAsyncComponent(options) {
  if (typeof options === 'function') {
    options = {
      loader: options
    }
  }

  const { loader } = options

  let InnerComp = null

  // 记录重试此时
  let retries = 0

  // 封装load函数用于加载异步组件
  function load() {
    return loader()
      // 捕获加载器的错误
      .catch(err => {
        // 如果用户指定了 onError 回调，则将控制权交给用户
        if (options.onError) {
          // 当错误发生时，返回一个新的 Promise 实例，并调用 onError 回调，同时将retry 函数作为 onError 回调的参数
          return new Promise((resolve, reject) => {
            // retry 重试函数，执行该函数会重新调用 load 函数并发送请求
            const retry = () => {
              resolve(load())
              retries++
            }
            // 失败
            const fail = () => reject(err)
            // 作为 onError 回调函数的参数，让用户决定下一步怎么做
            options.onError(retry, fail, retries)
          })
        } else {
          throw err
        }
      })
  }

  return {
    name: 'AsyncComponentWrapper',
    setup() {
      const loaded = ref(false)
      const error = shallowRef(null)
      const loading = ref(false)

      // NOTE 延迟展示和loading
      let loadingTimer = null
      if (options.delay) {
        loadingTimer = setTimeout(() => {
          loading.value = true
        }, options.delay)
      } else {
        loading.value = true
      }

      // NOTE 调用加载器
      load().then(c => {
        InnerComp = c
        loaded.value = true
      }).catch(() => {
        error.value = err
      }).finally(() => {
        loading.value = false
        clearTimeout(loadingTimer)
      })

      // NOTE 解决超时问题
      let timer = null
      if (options.timeout) {
        timer = setTimeout(() => {
          const err = new Error(`Async component timed out after ${options.timeout}ms`)
          error.value = err
        }, options.timeout)
      }


      const placeholder = { type: Text, children: '' }
      return () => {
        if (loaded.value) {
          return { type: InnerComp }
        } else if (error.value && options.errorComponent) {
          return { type: options.errorComponent, props: { error: error.value } }
        } else if (loading.value && options.loadingComponent) {
          return { type: options.loadingComponent }
        } else {
          return placeholder
        }
      }
    }
  }
}
