import { useState } from 'react'

export function useListToggle() {
  const [shown, setShown] = useState(false)
  const [visible, setVisible] = useState(10)

  function toggle() {
    setShown((s) => !s)
  }
  function showMore() {
    setVisible((v) => v + 10)
  }

  return { shown, visible, toggle, showMore }
}
