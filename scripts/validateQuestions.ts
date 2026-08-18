/**
 * Developer-side validation script for question datasets.
 * 
 * This tool detects:
 * - Duplicate IDs
 * - Invalid category IDs
 * - Invalid points
 * - Missing fields
 * - Empty questions
 * - Empty answers
 * - Malformed images
 * - Duplicate questions
 * 
 * Usage: node scripts/validateQuestions.ts
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

interface QuestionItem {
  id?: string
  question: string
  answer: string
  points?: number
  media?: string
  image?: string
  mediaType?: string
  hint?: string
}

interface QuestionCollection {
  categoryId: string
  questions?: QuestionItem[]
  questionsByPoints?: Record<number, QuestionItem[]>
  metadata: {
    sectionId: string
    updatedAt: string
    status: string
  }
}

interface ValidationResult {
  file: string
  categoryId: string
  issues: {
    type: string
    severity: 'error' | 'warning' | 'info'
    message: string
    questionId?: string
  }[]
}

const VALID_POINTS = [100, 300, 500]
const VALID_MEDIA_TYPES = ['image', 'video', 'career']

function isPointValue(value: unknown): boolean {
  return value === 100 || value === 300 || value === 500
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeCategoryId(filePath: string): string {
  return filePath.trim().replace(/\.json$/i, '').split('/').pop() ?? filePath.trim()
}

function validateQuestionItem(item: QuestionItem, index: number, categoryId: string): ValidationResult['issues'] {
  const issues: ValidationResult['issues'] = []
  const questionId = item.id ?? `${categoryId}-index-${index}`

  // Required fields
  if (!isNonEmptyString(item.question)) {
    issues.push({
      type: 'missing_field',
      severity: 'error',
      message: 'Question text is empty or missing',
      questionId
    })
  }

  if (!isNonEmptyString(item.answer)) {
    issues.push({
      type: 'missing_field',
      severity: 'error',
      message: 'Answer is empty or missing',
      questionId
    })
  }

  // Points validation
  if (item.points !== undefined && !isPointValue(item.points)) {
    issues.push({
      type: 'invalid_points',
      severity: 'error',
      message: `Invalid points value: ${item.points}. Must be 100, 300, or 500`,
      questionId
    })
  }

  // ID validation
  if (item.id && !isNonEmptyString(item.id)) {
    issues.push({
      type: 'invalid_id',
      severity: 'error',
      message: 'Question ID is empty',
      questionId
    })
  }

  // Media validation
  if (item.media && !isNonEmptyString(item.media)) {
    issues.push({
      type: 'invalid_media',
      severity: 'warning',
      message: 'Media field is present but empty',
      questionId
    })
  }

  if (item.image && !isNonEmptyString(item.image)) {
    issues.push({
      type: 'invalid_image',
      severity: 'warning',
      message: 'Image field is present but empty',
      questionId
    })
  }

  if (item.mediaType && !VALID_MEDIA_TYPES.includes(item.mediaType)) {
    issues.push({
      type: 'invalid_media_type',
      severity: 'warning',
      message: `Invalid mediaType: ${item.mediaType}. Must be one of: ${VALID_MEDIA_TYPES.join(', ')}`,
      questionId
    })
  }

  return issues
}

function validateQuestionCollection(data: unknown, filePath: string): ValidationResult {
  const issues: ValidationResult['issues'] = []
  const categoryId = normalizeCategoryId(filePath)

  if (!data || typeof data !== 'object') {
    return {
      file: filePath,
      categoryId,
      issues: [{
        type: 'invalid_json',
        severity: 'error',
        message: 'File does not contain a valid object'
      }]
    }
  }

  const collection = data as Partial<QuestionCollection>

  // Category ID validation
  const declaredCategoryId = typeof collection.categoryId === 'string' ? collection.categoryId.trim() : ''
  const finalCategoryId = declaredCategoryId || categoryId

  if (!isNonEmptyString(finalCategoryId)) {
    issues.push({
      type: 'invalid_category_id',
      severity: 'error',
      message: 'Category ID is missing or empty'
    })
  }

  if (declaredCategoryId && declaredCategoryId !== finalCategoryId) {
    issues.push({
      type: 'category_id_mismatch',
      severity: 'warning',
      message: `Declared categoryId "${declaredCategoryId}" differs from filename "${categoryId}"`
    })
  }

  // Metadata validation
  if (!collection.metadata || typeof collection.metadata !== 'object') {
    issues.push({
      type: 'missing_metadata',
      severity: 'warning',
      message: 'Metadata is missing or invalid'
    })
  } else {
    if (!isNonEmptyString(collection.metadata.sectionId)) {
      issues.push({
        type: 'invalid_metadata',
        severity: 'warning',
        message: 'Metadata sectionId is missing or empty'
      })
    }
  }

  // Questions validation
  const questions = Array.isArray(collection.questions) ? collection.questions : []
  
  if (questions.length === 0) {
    issues.push({
      type: 'no_questions',
      severity: 'warning',
      message: 'No questions found in this file'
    })
  }

  // Validate each question
  const allIds = new Set<string>()
  const fingerprints = new Set<string>()

  questions.forEach((item, index) => {
    const itemIssues = validateQuestionItem(item, index, finalCategoryId)
    issues.push(...itemIssues)

    // Check for duplicate IDs
    if (item.id) {
      if (allIds.has(item.id)) {
        issues.push({
          type: 'duplicate_id',
          severity: 'error',
          message: `Duplicate question ID: ${item.id}`,
          questionId: item.id
        })
      }
      allIds.add(item.id)
    }

    // Check for duplicate questions (by fingerprint)
    const fingerprint = `${item.question.trim().toLowerCase()}|${item.answer.trim().toLowerCase()}`
    if (fingerprints.has(fingerprint)) {
      issues.push({
        type: 'duplicate_question',
        severity: 'warning',
        message: 'Duplicate question content (same question and answer)',
        questionId: item.id
      })
    }
    fingerprints.add(fingerprint)
  })

  // QuestionsByPoints validation (if present)
  if (collection.questionsByPoints) {
    const pointsKeys = Object.keys(collection.questionsByPoints).map(Number)
    const invalidPoints = pointsKeys.filter(p => !isPointValue(p))
    
    if (invalidPoints.length > 0) {
      issues.push({
        type: 'invalid_points_in_structure',
        severity: 'error',
        message: `Invalid point values in questionsByPoints: ${invalidPoints.join(', ')}`
      })
    }
  }

  return {
    file: filePath,
    categoryId: finalCategoryId,
    issues
  }
}

function findQuestionFiles(dir: string): string[] {
  const files: string[] = []
  
  function scan(currentDir: string) {
    const entries = readdirSync(currentDir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)
      
      if (entry.isDirectory()) {
        scan(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        files.push(fullPath)
      }
    }
  }
  
  scan(dir)
  return files
}

function main() {
  const questionsDir = join(process.cwd(), 'src', 'data', 'questions')
  
  console.log('🔍 Starting question validation...\n')
  
  const files = findQuestionFiles(questionsDir)
  console.log(`Found ${files.length} question files\n`)
  
  const results: ValidationResult[] = []
  const allCategoryIds = new Set<string>()
  const allIds = new Map<string, string>() // id -> file
  
  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8')
      const data = JSON.parse(content)
      const result = validateQuestionCollection(data, file)
      results.push(result)
      
      // Track category IDs
      if (result.categoryId) {
        allCategoryIds.add(result.categoryId)
      }
      
      // Track all question IDs for cross-file duplicates
      const collection = data as Partial<QuestionCollection>
      if (collection.questions) {
        for (const question of collection.questions) {
          if (question.id) {
            const existingFile = allIds.get(question.id)
            if (existingFile && existingFile !== file) {
              result.issues.push({
                type: 'cross_file_duplicate_id',
                severity: 'error',
                message: `Question ID "${question.id}" already exists in: ${existingFile}`,
                questionId: question.id
              })
            }
            allIds.set(question.id, file)
          }
        }
      }
    } catch (error) {
      results.push({
        file,
        categoryId: 'unknown',
        issues: [{
          type: 'parse_error',
          severity: 'error',
          message: `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`
        }]
      })
    }
  }
  
  // Print results
  let totalErrors = 0
  let totalWarnings = 0
  let totalInfo = 0
  
  for (const result of results) {
    if (result.issues.length === 0) continue
    
    console.log(`📄 ${result.file}`)
    console.log(`   Category ID: ${result.categoryId}`)
    
    for (const issue of result.issues) {
      const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'
      console.log(`   ${icon} [${issue.type}] ${issue.message}`)
      if (issue.questionId) {
        console.log(`      Question ID: ${issue.questionId}`)
      }
      
      if (issue.severity === 'error') totalErrors++
      else if (issue.severity === 'warning') totalWarnings++
      else totalInfo++
    }
    
    console.log()
  }
  
  // Summary
  console.log('='.repeat(50))
  console.log('📊 Validation Summary')
  console.log('='.repeat(50))
  console.log(`Total files scanned: ${files.length}`)
  console.log(`Total categories found: ${allCategoryIds.size}`)
  console.log(`Total unique question IDs: ${allIds.size}`)
  console.log(`❌ Errors: ${totalErrors}`)
  console.log(`⚠️  Warnings: ${totalWarnings}`)
  console.log(`ℹ️  Info: ${totalInfo}`)
  
  if (totalErrors > 0) {
    console.log('\n❌ Validation failed with errors')
    process.exit(1)
  } else if (totalWarnings > 0) {
    console.log('\n⚠️  Validation passed with warnings')
    process.exit(0)
  } else {
    console.log('\n✅ Validation passed successfully')
    process.exit(0)
  }
}

main()
