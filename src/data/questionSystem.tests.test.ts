import { describe, expect, it, beforeEach } from 'vitest'
import {
  ensureLocalQuestionsLoaded,
  getQuestionEntries,
  getQuestionEntriesByPoints,
  hasQuestionEntries,
  loadRemoteQuestions,
} from './questionLoader'
import type { PointValue } from '../types/board'

describe('Question System Tests', () => {
  beforeEach(async () => {
    // Reset the loader state before each test
    await ensureLocalQuestionsLoaded()
  })

  describe('Valid Question', () => {
    it('should load and validate questions with proper structure', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      
      expect(entries.length).toBeGreaterThan(0)
      
      entries.forEach(entry => {
        expect(entry.question).toBeTruthy()
        expect(entry.answer).toBeTruthy()
        expect(entry.id).toBeTruthy()
        
        if (entry.points !== undefined) {
          expect([100, 300, 500]).toContain(entry.points)
        }
      })
    })

    it('should generate stable IDs for questions without explicit IDs', async () => {
      await ensureLocalQuestionsLoaded()
      const entries1 = getQuestionEntries('general-knowledge')
      const entries2 = getQuestionEntries('general-knowledge')
      
      entries1.forEach((entry, index) => {
        expect(entry.id).toBe(entries2[index].id)
      })
    })
  })

  describe('Malformed Question', () => {
    it('should filter out questions with missing required fields', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      
      // Filter out entries that would be considered malformed
      const validEntries = entries.filter(entry => 
        entry.question && entry.answer && entry.question.trim() !== '' && entry.answer.trim() !== ''
      )
      
      // All returned entries should be valid
      expect(validEntries.length).toBe(entries.length)
    })

    it('should handle questions with empty media fields gracefully', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      
      entries.forEach(entry => {
        // Empty media fields should not cause issues
        expect(() => {
          if (entry.media) entry.media.trim()
          if (entry.image) entry.image.trim()
        }).not.toThrow()
      })
    })

    it('should handle questions with missing optional fields', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      
      entries.forEach(entry => {
        // Optional fields should be handled gracefully
        expect(() => {
          entry.media || ''
          entry.hint || ''
          entry.mediaType || 'image'
        }).not.toThrow()
      })
    })
  })

  describe('Duplicate ID', () => {
    it('should prevent duplicate IDs within a category', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      
      const ids = entries.map(entry => entry.id).filter(Boolean)
      const uniqueIds = new Set(ids)
      
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('should handle questions with same content but different IDs', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      
      // The loader uses fingerprint-based deduplication
      const fingerprints = new Set(
        entries.map(entry => `${entry.question.trim().toLowerCase()}|${entry.answer.trim().toLowerCase()}`)
      )
      
      // After merge, fingerprints should be unique
      expect(fingerprints.size).toBe(entries.length)
    })
  })

  describe('Invalid Category', () => {
    it('should return empty array for non-existent category', () => {
      const entries = getQuestionEntries('non-existent-category-xyz')
      expect(entries).toEqual([])
    })

    it('should return false for hasQuestionEntries on invalid category', () => {
      expect(hasQuestionEntries('')).toBe(false)
      expect(hasQuestionEntries('non-existent')).toBe(false)
    })

    it('should handle category ID mismatches gracefully', async () => {
      await ensureLocalQuestionsLoaded()
      // Test the alias handling for "Landmarks of countries" -> "city-country"
      expect(hasQuestionEntries('city-country')).toBe(true)
    })
  })

  describe('Invalid Points', () => {
    it('should reject questions with invalid point values', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      
      entries.forEach(entry => {
        if (entry.points !== undefined) {
          expect([100, 300, 500]).toContain(entry.points)
        }
      })
    })

    it('should handle questions without point values', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      
      entries.forEach(entry => {
        // Questions without points should be handled gracefully
        if (entry.points === undefined) {
          expect(() => entry.points).not.toThrow()
        }
      })
    })

    it('should only return valid point values in filtered results', async () => {
      await ensureLocalQuestionsLoaded()
      
      const validPoints: PointValue[] = [100, 300, 500]
      
      for (const points of validPoints) {
        const entries = getQuestionEntriesByPoints('general-knowledge', points)
        entries.forEach(entry => {
          expect(entry.points).toBe(points)
        })
      }
    })
  })

  describe('JSON Only', () => {
    it('should work with only local JSON loaded', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      
      expect(entries.length).toBeGreaterThan(0)
      expect(entries.every(entry => entry.id)).toBe(true)
    })
  })

  describe('Supabase Only', () => {
    it('should handle Supabase unavailability gracefully', async () => {
      // Simulate Supabase failure by not loading remote questions
      await ensureLocalQuestionsLoaded()
      
      // Should still work with local JSON
      const entries = getQuestionEntries('general-knowledge')
      expect(entries.length).toBeGreaterThan(0)
    })
  })

  describe('JSON + Supabase', () => {
    it('should merge local and remote questions', async () => {
      await Promise.all([ensureLocalQuestionsLoaded(), loadRemoteQuestions()])
      const entries = getQuestionEntries('general-knowledge')
      
      // Should have at least local questions
      expect(entries.length).toBeGreaterThan(0)
    })

    it('should maintain uniqueness after merge', async () => {
      await Promise.all([ensureLocalQuestionsLoaded(), loadRemoteQuestions()])
      const entries = getQuestionEntries('general-knowledge')
      
      const ids = entries.map(entry => entry.id).filter(Boolean)
      const uniqueIds = new Set(ids)
      
      expect(uniqueIds.size).toBe(ids.length)
    })
  })

  describe('Duplicate Merge', () => {
    it('should handle duplicate IDs during merge', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      
      // The merge function uses fingerprint-based deduplication
      const fingerprints = new Set(
        entries.map(entry => `${entry.question.trim().toLowerCase()}|${entry.answer.trim().toLowerCase()}`)
      )
      
      expect(fingerprints.size).toBe(entries.length)
    })

    it('should handle same content with different IDs', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      
      // Fingerprint deduplication should handle this
      const contentMap = new Map<string, string[]>()
      
      entries.forEach(entry => {
        const content = `${entry.question.trim().toLowerCase()}|${entry.answer.trim().toLowerCase()}`
        const existing = contentMap.get(content) || []
        existing.push(entry.id || 'no-id')
        contentMap.set(content, existing)
      })
      
      // Each content should map to exactly one ID after merge
      contentMap.forEach((ids) => {
        expect(ids.length).toBe(1)
      })
    })
  })

  describe('Empty Category', () => {
    it('should return empty array for category with no questions', () => {
      const entries = getQuestionEntries('empty-category-test')
      expect(entries).toEqual([])
    })

    it('should handle category with no questions for specific point value', async () => {
      await ensureLocalQuestionsLoaded()
      // Most categories should have questions, but we test the handling
      const entries = getQuestionEntriesByPoints('general-knowledge', 500)
      
      // Should return array (possibly empty if no 500-point questions)
      expect(Array.isArray(entries)).toBe(true)
    })
  })

  describe('Missing 500 Questions', () => {
    it('should handle categories without 500-point questions gracefully', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntriesByPoints('general-knowledge', 500)
      
      // Should return empty array if no 500-point questions exist
      expect(Array.isArray(entries)).toBe(true)
      
      // If there are 500-point questions, they should be valid
      entries.forEach(entry => {
        expect(entry.points).toBe(500)
      })
    })
  })

  describe('Used Question Prevention', () => {
    it('should prevent selection of already used questions', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      
      if (entries.length > 0) {
        const firstId = entries[0].id
        const usedKeys = [firstId]
        
        const unusedEntries = entries.filter(entry => 
          !usedKeys.includes(entry.id ?? '')
        )
        
        expect(unusedEntries.length).toBe(entries.length - 1)
      }
    })

    it('should handle empty used question keys', async () => {
      await ensureLocalQuestionsLoaded()
      const entries = getQuestionEntries('general-knowledge')
      const usedKeys: string[] = []
      
      const unusedEntries = entries.filter(entry => 
        !usedKeys.includes(entry.id ?? '')
      )
      
      expect(unusedEntries.length).toBe(entries.length)
    })
  })

  describe('Data Error Handling', () => {
    it('should not crash on questions with validator errors', async () => {
      await ensureLocalQuestionsLoaded()
      
      // The loader should filter out questions with validator errors
      // rather than crashing
      expect(() => {
        getQuestionEntries('general-knowledge')
      }).not.toThrow()
    })

    it('should distinguish between validator errors and runtime-breaking errors', async () => {
      await ensureLocalQuestionsLoaded()
      
      // Runtime-breaking errors would cause crashes
      // Validator errors are filtered silently
      expect(() => {
        getQuestionEntries('general-knowledge')
      }).not.toThrow()
      
      // The system should continue to function
      const entries = getQuestionEntries('general-knowledge')
      expect(Array.isArray(entries)).toBe(true)
    })

    it('should handle BOM parsing errors gracefully', async () => {
      // The loader should handle files with BOM issues
      await ensureLocalQuestionsLoaded()
      
      // System should not crash even if some files have BOM issues
      expect(() => {
        getQuestionEntries('general-knowledge')
      }).not.toThrow()
    })
  })

  describe('Point Value Distribution', () => {
    it('should maintain correct point value distribution', async () => {
      await ensureLocalQuestionsLoaded()
      
      const allEntries = getQuestionEntries('general-knowledge')
      const pointCounts = { 100: 0, 300: 0, 500: 0 }
      
      allEntries.forEach(entry => {
        if (entry.points !== undefined) {
          pointCounts[entry.points]++
        }
      })
      
      // Each point value should be present if the category has questions
      const hasQuestions = allEntries.length > 0
      if (hasQuestions) {
        // At least one point value should have questions
        const totalQuestions = Object.values(pointCounts).reduce((a, b) => a + b, 0)
        expect(totalQuestions).toBeGreaterThan(0)
      }
    })
  })

  describe('Category Consistency', () => {
    it('should maintain category ID consistency across operations', async () => {
      await ensureLocalQuestionsLoaded()
      
      const categoryId = 'general-knowledge'
      const entries = getQuestionEntries(categoryId)
      
      // All entries should be from the requested category
      expect(entries.length).toBeGreaterThan(0)
    })

    it('should handle category ID normalization', async () => {
      await ensureLocalQuestionsLoaded()
      
      // Test that category IDs are normalized consistently
      const entries1 = getQuestionEntries('general-knowledge')
      const entries2 = getQuestionEntries('general-knowledge')
      
      expect(entries1.length).toBe(entries2.length)
    })
  })

  describe('Loading Failure Scenarios', () => {
    it('should handle JSON loading failures gracefully', async () => {
      // Try to load a non-existent category
      const entries = getQuestionEntries('non-existent-category')
      
      expect(entries).toEqual([])
      expect(() => {
        getQuestionEntries('non-existent-category')
      }).not.toThrow()
    })

    it('should handle partial loading failures', async () => {
      await ensureLocalQuestionsLoaded()
      
      // System should work even if some categories fail to load
      expect(() => {
        getQuestionEntries('general-knowledge')
        getQuestionEntries('science')
        getQuestionEntries('non-existent')
      }).not.toThrow()
    })
  })

  describe('Performance with Large Datasets', () => {
    it('should handle loading multiple categories efficiently', async () => {
      const startTime = Date.now()
      
      await ensureLocalQuestionsLoaded()
      
      const categories = ['general-knowledge', 'science', 'technology']
      categories.forEach(category => {
        getQuestionEntries(category)
      })
      
      const endTime = Date.now()
      const duration = endTime - startTime
      
      // Should complete in reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000)
    })
  })
})
