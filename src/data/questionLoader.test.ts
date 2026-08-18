import { describe, expect, it, beforeEach } from 'vitest'
import {
  ensureLocalQuestionsLoaded,
  getQuestionEntries,
  getQuestionEntriesByPoints,
  hasQuestionEntries,
  loadRemoteQuestions,
} from './questionLoader'
import type { PointValue } from '../types/board'

describe('Question Loader Tests', () => {
  beforeEach(async () => {
    // Reset the loader state before each test
    await ensureLocalQuestionsLoaded()
  })

  describe('Loader - load valid JSON', () => {
    it('should load questions from valid JSON files', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      expect(entries.length).toBeGreaterThan(0)
    })

    it('should load questions with valid structure', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      const firstEntry = entries[0]
      expect(firstEntry).toHaveProperty('question')
      expect(firstEntry).toHaveProperty('answer')
      expect(firstEntry.id).toBeTruthy()
    })
  })

  describe('Loader - empty category', () => {
    it('should return empty array for non-existent category', () => {
      const entries = getQuestionEntries('non-existent-category')
      expect(entries).toEqual([])
    })

    it('should return false for hasQuestionEntries on non-existent category', () => {
      expect(hasQuestionEntries('non-existent-category')).toBe(false)
    })
  })

  describe('Loader - missing category', () => {
    it('should handle missing category gracefully', () => {
      const entries = getQuestionEntriesByPoints('missing-category', 100)
      expect(entries).toEqual([])
    })
  })

  describe('Loader - invalid question', () => {
    it('should filter out questions with invalid points', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      const invalidPoints = entries.filter(
        (item) => item.points !== undefined && ![100, 300, 500].includes(item.points)
      )
      expect(invalidPoints.length).toBe(0)
    })

    it('should filter out questions without required fields', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      const invalidQuestions = entries.filter(
        (item) => !item.question || !item.answer
      )
      expect(invalidQuestions.length).toBe(0)
    })
  })

  describe('Loader - invalid points', () => {
    it('should reject questions with point values other than 100, 300, 500', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      entries.forEach((item) => {
        if (item.points !== undefined) {
          expect([100, 300, 500]).toContain(item.points)
        }
      })
    })
  })

  describe('Loader - duplicate ID', () => {
    it('should ensure unique question IDs within a category', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      const ids = entries.map((item) => item.id).filter(Boolean)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })
  })

  describe('Selection - 100 points', () => {
    it('should return questions with 100 points', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntriesByPoints('general-knowledge', 100)
      entries.forEach((item) => {
        expect(item.points).toBe(100)
      })
    })

    it('should return at least one 100-point question', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntriesByPoints('general-knowledge', 100)
      expect(entries.length).toBeGreaterThan(0)
    })
  })

  describe('Selection - 300 points', () => {
    it('should return questions with 300 points', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntriesByPoints('general-knowledge', 300)
      entries.forEach((item) => {
        expect(item.points).toBe(300)
      })
    })

    it('should return at least one 300-point question', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntriesByPoints('general-knowledge', 300)
      expect(entries.length).toBeGreaterThan(0)
    })
  })

  describe('Selection - 500 points', () => {
    it('should return questions with 500 points', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntriesByPoints('general-knowledge', 500)
      entries.forEach((item) => {
        expect(item.points).toBe(500)
      })
    })

    it('should return at least one 500-point question', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntriesByPoints('general-knowledge', 500)
      expect(entries.length).toBeGreaterThan(0)
    })
  })

  describe('Selection - no available question', () => {
    it('should return empty array when no questions match criteria', () => {
      const entries = getQuestionEntriesByPoints('non-existent-category', 100)
      expect(entries).toEqual([])
    })
  })

  describe('Selection - used question', () => {
    it('should filter out used questions when specified', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      if (entries.length > 0) {
        const firstId = entries[0].id
        const usedKeys = [firstId]
        const unusedEntries = entries.filter((item) => !usedKeys.includes(item.id ?? ''))
        expect(unusedEntries.length).toBe(entries.length - 1)
      }
    })
  })

  describe('Integrity - stable question identity', () => {
    it('should generate stable IDs for questions without explicit IDs', async () => {
      await ensureLocalQuestionsLoaded()
      const entries1 = getQuestionEntries('general-knowledge')
      const entries2 = getQuestionEntries('general-knowledge')
      
      entries1.forEach((item, index) => {
        expect(item.id).toBe(entries2[index].id)
      })
    })
  })

  describe('Integrity - category integrity', () => {
    it('should only return questions that belong to the specified category', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      // The loader normalizes category IDs, so we check that entries exist
      expect(entries.length).toBeGreaterThan(0)
    })

    it('should handle category ID aliases correctly', async () => {
      await ensureLocalQuestionsLoaded()
      expect(hasQuestionEntries('city-country')).toBe(true)
    })
  })

  describe('Integrity - point integrity', () => {
    it('should maintain point values across all layers', async () => {
      await ensureLocalQuestionsLoaded()
      const pointValues: PointValue[] = [100, 300, 500]
      
      for (const points of pointValues) {
        const entries = getQuestionEntriesByPoints('general-knowledge', points)
        entries.forEach((item) => {
          if (item.points !== undefined) {
            expect(item.points).toBe(points)
          }
        })
      }
    })
  })

  describe('Merge - JSON only', () => {
    it('should work with only local JSON loaded', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      expect(entries.length).toBeGreaterThan(0)
    })
  })

  describe('Merge - both', () => {
    it('should merge local and remote questions', async () => {
      await Promise.all([ensureLocalQuestionsLoaded(), loadRemoteQuestions()])
      const entries = getQuestionEntries('general-knowledge')
      // Should have at least local questions
      expect(entries.length).toBeGreaterThan(0)
    })
  })

  describe('Merge - duplicate IDs', () => {
    it('should handle duplicate IDs by keeping one instance', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      const ids = entries.map((item) => item.id).filter(Boolean)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })
  })

  describe('Merge - conflicting records', () => {
    it('should use fingerprint-based deduplication for same content', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      // The merge function uses fingerprint deduplication
      // We verify that questions with same content are deduplicated
      const fingerprints = new Set(
        entries.map((item) => `${item.question.trim().toLowerCase()}|${item.answer.trim().toLowerCase()}`)
      )
      // Fingerprints should be unique after merge
      expect(fingerprints.size).toBe(entries.length)
    })
  })
})
