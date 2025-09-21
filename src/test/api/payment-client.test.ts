import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import apiClient from '@/lib/api'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock TokenStorage
const mockTokenStorage = {
  getToken: vi.fn(),
  setToken: vi.fn(),
  removeToken: vi.fn()
}

vi.mock('@/utils/tokenStorage', () => ({
  TokenStorage: mockTokenStorage
}))

// Mock jwt utilities
vi.mock('@/utils/jwt', () => ({
  isTokenExpired: vi.fn(() => false),
  shouldRefreshToken: vi.fn(() => false)
}))

describe('Payment API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTokenStorage.getToken.mockReturnValue('mock-token')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const mockSuccessResponse = (data: any) => ({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ success: true, data }),
    text: vi.fn().mockResolvedValue(''),
    headers: new Headers()
  })

  const mockErrorResponse = (status: number, message: string) => ({
    ok: false,
    status,
    json: vi.fn().mockResolvedValue({ success: false, error: message }),
    text: vi.fn().mockResolvedValue(message),
    headers: new Headers()
  })

  describe('Payment CRUD Operations', () => {
    describe('createPayment', () => {
      it('should create payment successfully', async () => {
        const paymentData = {
          studentId: 'student-1',
          branchId: 'branch-1',
          feeItems: [
            {
              feeCategoryId: 'fee-1',
              quantity: 1,
              discountPercentage: 10
            }
          ],
          paymentMethod: 'cash',
          payerName: 'John Doe Sr.',
          payerPhone: '+1234567890',
          payerEmail: 'john.doe.sr@email.com'
        }

        const expectedResponse = {
          payment: {
            id: 'payment-1',
            receiptNo: 'RCP001',
            studentId: 'student-1',
            totalAmount: 990.00,
            status: 'completed'
          },
          details: [
            {
              id: 'detail-1',
              feeCategoryId: 'fee-1',
              originalAmount: 1000.00,
              discountAmount: 100.00,
              paidAmount: 990.00
            }
          ],
          summary: {
            paymentId: 'payment-1',
            totalItems: 1,
            totalPaid: 990.00
          }
        }

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(expectedResponse))

        const result = await apiClient.payments.create(paymentData)

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/payments/'),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer mock-token'
            },
            body: JSON.stringify(paymentData)
          }
        )

        expect(result.success).toBe(true)
        expect(result.data).toEqual(expectedResponse)
      })

      it('should handle payment creation validation errors', async () => {
        const invalidPaymentData = {
          studentId: '',
          branchId: 'branch-1',
          feeItems: [],
          paymentMethod: 'cash'
        }

        mockFetch.mockResolvedValueOnce(mockErrorResponse(422, 'Validation failed'))

        const result = await apiClient.payments.create(invalidPaymentData)

        expect(result.success).toBe(false)
        expect(result.error).toBe('Validation failed')
      })

      it('should handle network errors during payment creation', async () => {
        const paymentData = {
          studentId: 'student-1',
          branchId: 'branch-1',
          feeItems: [{ feeCategoryId: 'fee-1', quantity: 1 }],
          paymentMethod: 'cash'
        }

        mockFetch.mockRejectedValueOnce(new Error('Network error'))

        const result = await apiClient.payments.create(paymentData)

        expect(result.success).toBe(false)
        expect(result.error).toContain('Network error')
      })

      it('should handle authentication errors', async () => {
        const paymentData = {
          studentId: 'student-1',
          branchId: 'branch-1',
          feeItems: [{ feeCategoryId: 'fee-1', quantity: 1 }],
          paymentMethod: 'cash'
        }

        mockFetch.mockResolvedValueOnce(mockErrorResponse(401, 'Unauthorized'))

        const result = await apiClient.payments.create(paymentData)

        expect(result.success).toBe(false)
        expect(result.error).toBe('Unauthorized')
      })
    })

    describe('getPayments', () => {
      it('should fetch payments with default parameters', async () => {
        const mockPayments = [
          {
            id: 'payment-1',
            receiptNo: 'RCP001',
            studentName: 'John Doe',
            totalAmount: 1000.00,
            status: 'completed'
          },
          {
            id: 'payment-2',
            receiptNo: 'RCP002',
            studentName: 'Jane Smith',
            totalAmount: 750.00,
            status: 'pending'
          }
        ]

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockPayments))

        const result = await apiClient.payments.getAll({ branchId: 'branch-1' })

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/payments/?branchId=branch-1'),
          {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer mock-token'
            }
          }
        )

        expect(result.success).toBe(true)
        expect(result.data).toEqual(mockPayments)
      })

      it('should fetch payments with filters', async () => {
        const filters = {
          branchId: 'branch-1',
          studentId: 'student-1',
          status: 'completed',
          paymentMethod: 'cash',
          fromDate: '2024-01-01',
          toDate: '2024-01-31',
          page: 2,
          limit: 20
        }

        mockFetch.mockResolvedValueOnce(mockSuccessResponse([]))

        await apiClient.payments.getAll(filters)

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/payments/'),
          expect.objectContaining({
            method: 'GET'
          })
        )

        // Check URL parameters
        const calledUrl = mockFetch.mock.calls[0][0]
        expect(calledUrl).toContain('branchId=branch-1')
        expect(calledUrl).toContain('studentId=student-1')
        expect(calledUrl).toContain('status=completed')
        expect(calledUrl).toContain('paymentMethod=cash')
        expect(calledUrl).toContain('fromDate=2024-01-01')
        expect(calledUrl).toContain('toDate=2024-01-31')
        expect(calledUrl).toContain('page=2')
        expect(calledUrl).toContain('limit=20')
      })

      it('should handle search queries', async () => {
        const searchParams = {
          branchId: 'branch-1',
          search: 'John Doe'
        }

        mockFetch.mockResolvedValueOnce(mockSuccessResponse([]))

        await apiClient.payments.getAll(searchParams)

        const calledUrl = mockFetch.mock.calls[0][0]
        expect(calledUrl).toContain('search=John%20Doe')
      })
    })

    describe('getPaymentById', () => {
      it('should fetch payment details successfully', async () => {
        const paymentId = 'payment-1'
        const mockPaymentDetails = {
          payment: {
            id: 'payment-1',
            receiptNo: 'RCP001',
            studentId: 'student-1',
            totalAmount: 1000.00,
            status: 'completed'
          },
          details: [
            {
              id: 'detail-1',
              feeCategoryId: 'fee-1',
              feeCategoryName: 'Tuition Fee',
              originalAmount: 1000.00,
              paidAmount: 1000.00
            }
          ],
          summary: {
            paymentId: 'payment-1',
            totalItems: 1,
            totalPaid: 1000.00
          }
        }

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockPaymentDetails))

        const result = await apiClient.payments.getById(paymentId)

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/payments/${paymentId}`),
          {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer mock-token'
            }
          }
        )

        expect(result.success).toBe(true)
        expect(result.data).toEqual(mockPaymentDetails)
      })

      it('should handle payment not found', async () => {
        const paymentId = 'non-existent'

        mockFetch.mockResolvedValueOnce(mockErrorResponse(404, 'Payment not found'))

        const result = await apiClient.payments.getById(paymentId)

        expect(result.success).toBe(false)
        expect(result.error).toBe('Payment not found')
      })

      it('should validate payment ID format', async () => {
        const invalidPaymentId = ''

        const result = await apiClient.payments.getById(invalidPaymentId)

        expect(result.success).toBe(false)
        expect(result.error).toContain('Invalid payment ID')
      })
    })

    describe('updatePayment', () => {
      it('should update payment successfully', async () => {
        const paymentId = 'payment-1'
        const updateData = {
          verificationStatus: 'verified',
          remarks: 'Payment verified and approved',
          bankName: 'Test Bank'
        }

        const updatedPayment = {
          id: 'payment-1',
          receiptNo: 'RCP001',
          verificationStatus: 'verified',
          remarks: 'Payment verified and approved',
          bankName: 'Test Bank',
          verifiedBy: 'admin-1',
          verifiedAt: '2024-01-15T10:30:00Z'
        }

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(updatedPayment))

        const result = await apiClient.payments.update(paymentId, updateData)

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/payments/${paymentId}`),
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer mock-token'
            },
            body: JSON.stringify(updateData)
          }
        )

        expect(result.success).toBe(true)
        expect(result.data).toEqual(updatedPayment)
      })

      it('should handle update validation errors', async () => {
        const paymentId = 'payment-1'
        const invalidUpdateData = {
          verificationStatus: 'invalid-status'
        }

        mockFetch.mockResolvedValueOnce(mockErrorResponse(422, 'Invalid verification status'))

        const result = await apiClient.payments.update(paymentId, invalidUpdateData)

        expect(result.success).toBe(false)
        expect(result.error).toBe('Invalid verification status')
      })

      it('should handle concurrent update conflicts', async () => {
        const paymentId = 'payment-1'
        const updateData = {
          remarks: 'Updated remarks'
        }

        mockFetch.mockResolvedValueOnce(mockErrorResponse(409, 'Payment has been modified by another user'))

        const result = await apiClient.payments.update(paymentId, updateData)

        expect(result.success).toBe(false)
        expect(result.error).toBe('Payment has been modified by another user')
      })
    })

    describe('cancelPayment', () => {
      it('should cancel payment successfully', async () => {
        const paymentId = 'payment-1'
        const cancellationData = {
          cancellationReason: 'Student requested cancellation'
        }

        const cancelledPayment = {
          id: 'payment-1',
          status: 'cancelled',
          cancellationReason: 'Student requested cancellation',
          cancelledBy: 'admin-1',
          cancelledAt: '2024-01-15T10:30:00Z'
        }

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(cancelledPayment))

        const result = await apiClient.payments.cancel(paymentId, cancellationData)

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/payments/${paymentId}/cancel`),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer mock-token'
            },
            body: JSON.stringify(cancellationData)
          }
        )

        expect(result.success).toBe(true)
        expect(result.data).toEqual(cancelledPayment)
      })

      it('should handle already cancelled payment', async () => {
        const paymentId = 'payment-1'
        const cancellationData = {
          cancellationReason: 'Duplicate cancellation'
        }

        mockFetch.mockResolvedValueOnce(mockErrorResponse(400, 'Payment is already cancelled'))

        const result = await apiClient.payments.cancel(paymentId, cancellationData)

        expect(result.success).toBe(false)
        expect(result.error).toBe('Payment is already cancelled')
      })
    })

    describe('refundPayment', () => {
      it('should process refund successfully', async () => {
        const paymentId = 'payment-1'
        const refundData = {
          refundAmount: 500.00,
          refundReference: 'REF123456',
          refundReason: 'Partial service not delivered'
        }

        const refundedPayment = {
          id: 'payment-1',
          status: 'partial_refund',
          refundAmount: 500.00,
          refundReference: 'REF123456',
          refundReason: 'Partial service not delivered',
          refundDate: '2024-01-15T10:30:00Z'
        }

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(refundedPayment))

        const result = await apiClient.payments.refund(paymentId, refundData)

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/payments/${paymentId}/refund`),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer mock-token'
            },
            body: JSON.stringify(refundData)
          }
        )

        expect(result.success).toBe(true)
        expect(result.data).toEqual(refundedPayment)
      })

      it('should handle excessive refund amount', async () => {
        const paymentId = 'payment-1'
        const refundData = {
          refundAmount: 2000.00, // More than original payment
          refundReason: 'Over-refund attempt'
        }

        mockFetch.mockResolvedValueOnce(mockErrorResponse(400, 'Refund amount exceeds remaining payment amount'))

        const result = await apiClient.payments.refund(paymentId, refundData)

        expect(result.success).toBe(false)
        expect(result.error).toBe('Refund amount exceeds remaining payment amount')
      })

      it('should handle refund of non-refundable payment', async () => {
        const paymentId = 'payment-1'
        const refundData = {
          refundAmount: 100.00,
          refundReason: 'Attempted refund'
        }

        mockFetch.mockResolvedValueOnce(mockErrorResponse(400, 'Only completed or verified payments can be refunded'))

        const result = await apiClient.payments.refund(paymentId, refundData)

        expect(result.success).toBe(false)
        expect(result.error).toBe('Only completed or verified payments can be refunded')
      })
    })
  })

  describe('Payment Summary and Statistics', () => {
    describe('getPaymentSummary', () => {
      it('should fetch payment summary successfully', async () => {
        const branchId = 'branch-1'
        const filters = {
          fromDate: '2024-01-01',
          toDate: '2024-01-31'
        }

        const mockSummary = {
          totalPayments: 150,
          totalAmount: 125000.00,
          totalDiscount: 5000.00,
          totalTax: 12500.00,
          totalLateFees: 1000.00,
          paymentMethods: {
            cash: 75,
            card: 45,
            bank_transfer: 20,
            cheque: 8,
            online: 2
          },
          statusBreakdown: {
            completed: 140,
            pending: 8,
            cancelled: 2
          }
        }

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockSummary))

        const result = await apiClient.payments.getSummary(branchId, filters)

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/payments/summary/branch?branchId=${branchId}`),
          expect.objectContaining({
            method: 'GET'
          })
        )

        const calledUrl = mockFetch.mock.calls[0][0]
        expect(calledUrl).toContain('fromDate=2024-01-01')
        expect(calledUrl).toContain('toDate=2024-01-31')

        expect(result.success).toBe(true)
        expect(result.data).toEqual(mockSummary)
      })

      it('should handle empty summary data', async () => {
        const branchId = 'branch-1'

        const emptySummary = {
          totalPayments: 0,
          totalAmount: 0,
          totalDiscount: 0,
          totalTax: 0,
          totalLateFees: 0,
          paymentMethods: {},
          statusBreakdown: {}
        }

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(emptySummary))

        const result = await apiClient.payments.getSummary(branchId)

        expect(result.success).toBe(true)
        expect(result.data.totalPayments).toBe(0)
      })
    })

    describe('getPaymentStats', () => {
      it('should fetch payment statistics successfully', async () => {
        const branchId = 'branch-1'
        const period = 'last_30_days'

        const mockStats = {
          totalPayments: 50,
          totalAmount: 45000.00,
          averagePayment: 900.00,
          monthlyGrowth: 15.5,
          weeklyGrowth: 8.2,
          topPaymentMethods: ['cash', 'card', 'bank_transfer'],
          peakPaymentDays: ['Monday', 'Wednesday', 'Friday'],
          verificationRate: 95.5
        }

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockStats))

        const result = await apiClient.dashboard.getPaymentStats(branchId, { period })

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/dashboard/payment-stats?branchId=${branchId}&period=${period}`),
          expect.objectContaining({
            method: 'GET'
          })
        )

        expect(result.success).toBe(true)
        expect(result.data).toEqual(mockStats)
      })
    })
  })

  describe('Bulk Import Operations', () => {
    describe('validateBulkImport', () => {
      it('should validate CSV data successfully', async () => {
        const csvData = `Student ID,Fee Category,Amount,Payment Method
STU001,Tuition Fee,1000,cash
STU002,Activity Fee,200,card`

        const validationData = {
          csvData,
          branchId: 'branch-1'
        }

        const mockValidationResponse = {
          validRecords: [
            {
              rowNumber: 2,
              studentId: 'STU001',
              studentName: 'John Doe',
              feeCategory: 'Tuition Fee',
              amount: 1000.00,
              paymentMethod: 'cash'
            },
            {
              rowNumber: 3,
              studentId: 'STU002',
              studentName: 'Jane Smith',
              feeCategory: 'Activity Fee',
              amount: 200.00,
              paymentMethod: 'card'
            }
          ],
          invalidRecords: [],
          summary: {
            totalRows: 2,
            validRows: 2,
            invalidRows: 0,
            totalAmount: 1200.00,
            duplicateCount: 0
          }
        }

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockValidationResponse))

        const result = await apiClient.payments.validateBulkImport(validationData)

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/payments/bulk-import/validate'),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer mock-token'
            },
            body: JSON.stringify(validationData)
          }
        )

        expect(result.success).toBe(true)
        expect(result.data).toEqual(mockValidationResponse)
      })

      it('should handle validation with errors', async () => {
        const csvData = `Student ID,Fee Category,Amount
STU999,Invalid Fee,abc`

        const validationData = {
          csvData,
          branchId: 'branch-1'
        }

        const mockValidationResponse = {
          validRecords: [],
          invalidRecords: [
            {
              rowNumber: 2,
              errors: ['Student ID not found', 'Invalid fee category', 'Invalid amount format'],
              rawData: ['STU999', 'Invalid Fee', 'abc']
            }
          ],
          summary: {
            totalRows: 1,
            validRows: 0,
            invalidRows: 1,
            totalAmount: 0,
            duplicateCount: 0
          }
        }

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockValidationResponse))

        const result = await apiClient.payments.validateBulkImport(validationData)

        expect(result.success).toBe(true)
        expect(result.data.invalidRecords).toHaveLength(1)
        expect(result.data.summary.validRows).toBe(0)
      })

      it('should handle malformed CSV data', async () => {
        const csvData = 'malformed,csv,data\nincomplete'

        const validationData = {
          csvData,
          branchId: 'branch-1'
        }

        mockFetch.mockResolvedValueOnce(mockErrorResponse(400, 'Invalid CSV format'))

        const result = await apiClient.payments.validateBulkImport(validationData)

        expect(result.success).toBe(false)
        expect(result.error).toBe('Invalid CSV format')
      })
    })

    describe('processBulkImport', () => {
      it('should process bulk import successfully', async () => {
        const validRecords = [
          {
            studentId: 'STU001',
            feeCategory: 'Tuition Fee',
            amount: 1000.00,
            paymentMethod: 'cash'
          }
        ]

        const importData = {
          validRecords,
          branchId: 'branch-1'
        }

        const mockImportResponse = {
          successfulImports: 1,
          failedImports: 0,
          totalAmount: 1000.00,
          paymentIds: ['payment-bulk-1'],
          errors: []
        }

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockImportResponse))

        const result = await apiClient.payments.bulkImport(importData)

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/payments/bulk-import/process'),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer mock-token'
            },
            body: JSON.stringify(importData)
          }
        )

        expect(result.success).toBe(true)
        expect(result.data).toEqual(mockImportResponse)
      })

      it('should handle partial import failures', async () => {
        const validRecords = [
          { studentId: 'STU001', feeCategory: 'Tuition Fee', amount: 1000.00 },
          { studentId: 'STU002', feeCategory: 'Activity Fee', amount: 200.00 }
        ]

        const importData = {
          validRecords,
          branchId: 'branch-1'
        }

        const mockImportResponse = {
          successfulImports: 1,
          failedImports: 1,
          totalAmount: 1000.00,
          paymentIds: ['payment-bulk-1'],
          errors: [
            {
              rowNumber: 3,
              error: 'Student STU002 enrollment not found for current academic year'
            }
          ]
        }

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockImportResponse))

        const result = await apiClient.payments.bulkImport(importData)

        expect(result.success).toBe(true)
        expect(result.data.successfulImports).toBe(1)
        expect(result.data.failedImports).toBe(1)
        expect(result.data.errors).toHaveLength(1)
      })
    })

    describe('downloadTemplate', () => {
      it('should download CSV template successfully', async () => {
        const branchId = 'branch-1'
        const mockBlob = new Blob(['csv,template,data'], { type: 'text/csv' })

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          blob: vi.fn().mockResolvedValue(mockBlob),
          headers: new Headers({
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="payment-template.csv"'
          })
        })

        const result = await apiClient.payments.downloadTemplate(branchId)

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/payments/bulk-import/template?branchId=${branchId}`),
          {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer mock-token'
            }
          }
        )

        expect(result).toBeInstanceOf(Blob)
        expect(result.type).toBe('text/csv')
      })

      it('should handle template download errors', async () => {
        const branchId = 'branch-1'

        mockFetch.mockResolvedValueOnce(mockErrorResponse(500, 'Template generation failed'))

        await expect(apiClient.payments.downloadTemplate(branchId)).rejects.toThrow('Template generation failed')
      })
    })
  })

  describe('Error Handling and Retry Logic', () => {
    it('should retry failed requests', async () => {
      const paymentId = 'payment-1'

      // First call fails with network error, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockSuccessResponse({ id: paymentId, status: 'completed' }))

      const result = await apiClient.payments.getById(paymentId)

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result.success).toBe(true)
    })

    it('should handle token expiration and refresh', async () => {
      const { isTokenExpired, shouldRefreshToken } = await import('@/utils/jwt')

      // Mock token expiration
      vi.mocked(isTokenExpired).mockReturnValueOnce(true)
      vi.mocked(shouldRefreshToken).mockReturnValueOnce(true)

      // Mock refresh token request
      mockFetch
        .mockResolvedValueOnce(mockSuccessResponse({ token: 'new-token' })) // Refresh response
        .mockResolvedValueOnce(mockSuccessResponse({ id: 'payment-1' })) // Actual request

      const result = await apiClient.payments.getById('payment-1')

      expect(mockTokenStorage.setToken).toHaveBeenCalledWith('new-token')
      expect(result.success).toBe(true)
    })

    it('should handle rate limiting with exponential backoff', async () => {
      const paymentData = {
        studentId: 'student-1',
        branchId: 'branch-1',
        feeItems: [{ feeCategoryId: 'fee-1', quantity: 1 }],
        paymentMethod: 'cash'
      }

      // Mock rate limiting responses
      mockFetch
        .mockResolvedValueOnce(mockErrorResponse(429, 'Rate limit exceeded'))
        .mockResolvedValueOnce(mockErrorResponse(429, 'Rate limit exceeded'))
        .mockResolvedValueOnce(mockSuccessResponse({ id: 'payment-1' }))

      const start = Date.now()
      const result = await apiClient.payments.create(paymentData)
      const duration = Date.now() - start

      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(result.success).toBe(true)
      // Should have waited for backoff (at least 1000ms for first retry)
      expect(duration).toBeGreaterThan(1000)
    })

    it('should abort requests that exceed timeout', async () => {
      const paymentId = 'payment-1'

      // Mock a request that never resolves
      mockFetch.mockImplementationOnce(() => new Promise(() => {}))

      // Set short timeout for testing
      const result = await apiClient.payments.getById(paymentId, { timeout: 100 })

      expect(result.success).toBe(false)
      expect(result.error).toContain('timeout')
    })
  })

  describe('Request Caching', () => {
    it('should cache GET requests', async () => {
      const branchId = 'branch-1'
      const mockSummary = { totalPayments: 10 }

      mockFetch.mockResolvedValue(mockSuccessResponse(mockSummary))

      // Make same request twice
      await apiClient.payments.getSummary(branchId)
      await apiClient.payments.getSummary(branchId)

      // Should only make one network request due to caching
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should invalidate cache after mutations', async () => {
      const branchId = 'branch-1'
      const paymentId = 'payment-1'
      const mockSummary = { totalPayments: 10 }
      const updatedSummary = { totalPayments: 11 }

      mockFetch
        .mockResolvedValueOnce(mockSuccessResponse(mockSummary)) // Initial summary
        .mockResolvedValueOnce(mockSuccessResponse({ id: paymentId })) // Create payment
        .mockResolvedValueOnce(mockSuccessResponse(updatedSummary)) // Summary after creation

      // Get initial summary (cached)
      await apiClient.payments.getSummary(branchId)

      // Create payment (should invalidate cache)
      await apiClient.payments.create({
        studentId: 'student-1',
        branchId,
        feeItems: [{ feeCategoryId: 'fee-1', quantity: 1 }],
        paymentMethod: 'cash'
      })

      // Get summary again (should fetch fresh data)
      const result = await apiClient.payments.getSummary(branchId)

      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(result.data.totalPayments).toBe(11)
    })
  })

  describe('Request Deduplication', () => {
    it('should deduplicate concurrent identical requests', async () => {
      const paymentId = 'payment-1'
      const mockPayment = { id: paymentId, status: 'completed' }

      mockFetch.mockResolvedValue(mockSuccessResponse(mockPayment))

      // Make multiple concurrent identical requests
      const promises = Array(5).fill(null).map(() =>
        apiClient.payments.getById(paymentId)
      )

      const results = await Promise.all(promises)

      // Should only make one network request
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // All results should be identical
      results.forEach(result => {
        expect(result.success).toBe(true)
        expect(result.data).toEqual(mockPayment)
      })
    })
  })
})