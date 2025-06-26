export type OnSubmitErrFunc<T, E = unknown> = (_data: T, err: E) => void

export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}
