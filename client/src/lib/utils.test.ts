// Tests for client/src/lib/utils.ts
import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn utility function', () => {
  it('should merge class names', () => {
    const result = cn('text-red-500', 'bg-blue-500')
    expect(result).toBe('text-red-500 bg-blue-500')
  })

  it('should handle conditional classes', () => {
    const result = cn('base-class', false && 'hidden-class', 'visible-class')
    expect(result).toBe('base-class visible-class')
  })

  it('should resolve Tailwind conflicts', () => {
    const result = cn('p-4', 'p-8')
    expect(result).toBe('p-8')
  })

  it('should handle arrays of classes', () => {
    const result = cn(['text-sm', 'font-bold'], 'text-center')
    expect(result).toBe('text-sm font-bold text-center')
  })

  it('should handle objects with conditional classes', () => {
    const result = cn({
      'text-red-500': true,
      'text-blue-500': false,
      'font-bold': true,
    })
    expect(result).toBe('text-red-500 font-bold')
  })

  it('should handle undefined and null inputs', () => {
    const result = cn('base', undefined, null, 'class')
    expect(result).toBe('base class')
  })

  it('should handle empty inputs', () => {
    const result = cn()
    expect(result).toBe('')
  })

  it('should handle nested arrays', () => {
    const result = cn(['text-sm', ['font-bold', 'text-center']])
    expect(result).toBe('text-sm font-bold text-center')
  })

  it('should merge multiple Tailwind conflicts correctly', () => {
    const result = cn('px-4 py-2', 'px-8')
    expect(result).toBe('py-2 px-8')
  })
})
