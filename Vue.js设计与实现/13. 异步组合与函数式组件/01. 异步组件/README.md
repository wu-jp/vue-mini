# 异步组件

## 异步组件解决的问题

通常在异步加载组件时，我们还要考虑以下几个方面。

- 如果组件加载失败或加载超时，是否要渲染 Error 组件？
- 组件在加载时，是否要展示占位的内容？例如渲染一个 Loading 组件。
- 组件加载的速度可能很快，也可能很慢，是否要设置一个延迟展示 Loading 组件的时间？如果组件在 200ms 内没有加载成功才展示 Loading 组件，这样可以避免由组件加载过快所导致的闪烁。
- 组件加载失败后，是否需要重试？为了替用户更好地解决上述问题，我们需要在框架层面为异步组件提供更好的封装支持，与之对应的能力如下。
- 允许用户指定加载出错时要渲染的组件。
- 允许用户指定 Loading 组件，以及展示该组件的延迟时间。
- 允许用户设置加载组件的超时时长。
- 组件加载失败时，为用户提供重试的能力。以上这些内容就是异步组件真正要解决的问题。

## 异步组件的实现

我们封装一个 defineAsyncComponent 函数，它是一个高阶组件：

```js
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
```
