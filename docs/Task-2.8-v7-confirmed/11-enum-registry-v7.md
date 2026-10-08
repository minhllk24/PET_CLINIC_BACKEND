# 11 Enum Registry v7

Sinh TU DONG tu `07-openapi-v7.yaml`. Audit: khong co hai enum cung tap gia tri duoi hai ten. Figma: FIGMA_AVAILABLE_BUT_NOT_FROZEN.

| Concept | OpenAPI schema | Canonical values | DB field | Ghi chu |
|---|---|---|---|---|
| systemRole | SystemRole | ADMIN, MANAGER, STAFF, CUSTOMER | users.systemRole | Khong co DOCTOR |
| staffSubRole | StaffSubRole | RECEPTIONIST, CARE_STAFF_GROOMER, VETERINARIAN, NURSE | staff_profiles.staffSubRole | Role tong quat cua Staff; khong dung truc tiep cho Service.requiredStaffRole |
| serviceType | ServiceType | GROOMING, MEDICAL | services.serviceType; appointments.serviceType | Nguon su that duy nhat. ServiceRecord.recordType chi la snapshot cua serviceType luc thuc hien |
| bookingMode | BookingMode | BOOKABLE, REQUEST_ONLY, CONTACT_ONLY | services.bookingMode |  |
| activationStatus | ActivationStatus | NO_ACCOUNT, PENDING_ACTIVATION, ACTIVATED | customers.activationStatus |  |
| accountStatus | AccountStatus | ACTIVE, BLOCKED | users.accountStatus | Chi Admin doi |
| activeStatus | ActiveStatus | ACTIVE, INACTIVE | *.status (service, category, voucher, variant, staff) |  |
| productStatus | ProductStatus | ACTIVE, INACTIVE, ARCHIVED | products.status |  |
| shiftStatus | ShiftStatus | ACTIVE, CANCELLED | shifts.status |  |
| appointmentStatus | AppointmentStatus | PENDING_PAYMENT, PENDING_CONFIRMATION, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW | appointments.status |  |
| appointmentRequestStatus | AppointmentRequestStatus | SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, CANCELLED | appointment_requests.status |  |
| orderStatus | OrderStatus | PENDING, CONFIRMED, PROCESSING, SHIPPED, COMPLETED, CANCELLED | orders.status |  |
| paymentStatus | PaymentStatus | PENDING, PAID, FAILED, CANCELLED, EXPIRED, REFUND_PENDING, REFUNDED | payments.status | FAILED, CANCELLED, EXPIRED la terminal; Order ONLINE_MOCK roi vao CANCELLED va hoan ton/voucher |
| paymentMethod | PaymentMethod | ONLINE_MOCK, PAY_AT_STORE, COD | payments.method | Tap tong hop cua hai nhom ben duoi |
| appointmentPaymentMethod | AppointmentPaymentMethod | ONLINE_MOCK, PAY_AT_STORE | appointments.paymentMethod (customer option) | Khong co COD |
| orderPaymentMethod (inline checkout) | CheckoutRequest.paymentMethod | ONLINE_MOCK, COD | orders.paymentMethod | ONLINE_MOCK, COD. Khong co PAY_AT_STORE |
| paymentKind | PaymentKind | DEPOSIT, BALANCE, FULL, ORDER | payments.kind | FULL = 100% online lich hen; DEPOSIT = coc 30% PAY_AT_STORE; BALANCE = phan con lai tai cua hang; ORDER = don hang |
| depositStatus | DepositStatus | NOT_REQUIRED, PENDING, HELD, APPLIED, REFUNDED, FORFEITED | appointments.deposit.status | Chi PAY_AT_STORE. HELD ghi nhan ngay khi coc thanh cong; APPLIED tu dong khi COMPLETED |
| bookingRefundStatus | BookingRefundStatus | REQUESTED, PROCESSING, APPROVED, REJECTED, REFUNDED | booking_refunds.status |  |
| orderReturnStatus | OrderReturnStatus | REQUESTED, PROCESSING, APPROVED, REJECTED, CANCELLED, RECEIVED, COMPLETED | order_returns.status | REQUESTED > PROCESSING > RECEIVED > APPROVED > COMPLETED. REJECTED |
| orderRefundStatus | OrderRefundStatus | PENDING, REFUNDED, FAILED | order_refunds.status |  |
| orderRefundCause | OrderRefundCause | RETURN, CANCELLATION | order_refunds.cause |  |
| serviceRecordStatus | ServiceRecordStatus | DRAFT, IN_PROGRESS, WAITING_VET_REVIEW, FINALIZED, REOPENED | service_records.status |  |
| inventoryTransactionType | InventoryTxType | RECEIPT, ISSUE, ADJUSTMENT, TRANSFER | inventory_transactions.transactionType |  |
| inventorySourceType | InventorySourceType | MANUAL, SERVICE_RECORD_REVISION, ORDER, TRANSFER | inventory_transactions.sourceType |  |
| voucherScope | VoucherScope | ORDER, PRODUCT, SERVICE | vouchers.scope |  |
| voucherDiscountType | VoucherDiscountType | PERCENTAGE, FIXED | vouchers.discountType |  |
| reviewTarget | ReviewTarget | PRODUCT, SERVICE | reviews.targetType |  |
| allowedActions (Appointment) | Appointment.allowedActions | RESCHEDULE, CANCEL, PAY_PREPAYMENT, PAY_BALANCE, REQUEST_REFUND | (tinh) | Server tinh |
| fulfillmentIssue | FulfillmentIssue | NOT_FULFILLABLE_BY_SINGLE_BRANCH, FULFILLMENT_NOT_CONFIGURED | (khong luu; tra o checkout quote/validate) | Ket qua resolver |
| errorCode | ErrorCode | VALIDATION_ERROR, AUTHENTICATION_ERROR, AUTHORIZATION_ERROR, OWNERSHIP_ERROR, BRANCH_SCOPE_ERROR, ASSIGNMENT_SCOPE_ERROR, NOT_FOUND, CONFLICT, SLOT_UNAVAILABLE, SHIFT_OVERLAP, IDEMPOTENCY_KEY_REUSED, INVALID_STATE_TRANSITION, RESCHEDULE_TOO_LATE, RESCHEDULE_LIMIT, MIXED_SERVICE_TYPES, SERVICE_NOT_ENABLED_AT_BRANCH, BOOKING_MODE_NOT_ALLOWED, INSUFFICIENT_INVENTORY, PAYMENT_STATE_ERROR, REFUND_STATE_ERROR, RETURN_WINDOW_EXPIRED, RETURN_QTY_EXCEEDS_RETURNABLE, MEDICAL_REVIEW_REQUIRED, EXTERNAL_PROVIDER_ERROR, RATE_LIMIT, INTERNAL_ERROR, PRODUCT_NOT_PURCHASABLE, VOUCHER_INVALID, ORDER_NOT_RETURNABLE, FULFILLMENT_NOT_CONFIGURED, STAFF_ROLE_MISMATCH, STAFF_UNAVAILABLE | (Problem.code) | RFC 9457 extension |

## Khong dua vao canonical
| Legacy / bi bo | Ly do |
|---|---|
| DOCTOR | thay bang STAFF + VETERINARIAN |
| waiting_store_payment, PARTIALLY_REFUNDED | khong thuoc payment status hien hanh |
| rescheduled, missed | rescheduleCount, NO_SHOW |
| ServiceRecord.recordType | ServiceRecord dùng `recordType` làm snapshot của `Service.serviceType`; Service/Appointment giữ `serviceType` canonical |
| Phuong thuc thanh toan chung cho hai target | Moi target co tap rieng: lich hen ONLINE_MOCK/PAY_AT_STORE, don hang ONLINE_MOCK/COD |

Moi concept mot ten; `status` khong dung chung nhieu nghia.

| serviceExecutionRole | ServiceExecutionRole | CARE_STAFF_GROOMER, NURSE, VETERINARIAN | services.requiredStaffRole / appointments.services[].requiredStaffRole | RECEPTIONIST khong phai execution role |
| serviceSegmentExecutionStatus | ServiceSegmentExecutionStatus | NOT_STARTED, IN_PROGRESS, COMPLETED | appointments.services[].executionStatus | Khong dong Appointments.status cho den khi tat ca segment completed |
| guestTokenType | (security scheme) | GUEST_LOOKUP, GUEST_CART | HTTP headers X-Guest-Lookup-Token / X-Guest-Cart-Token | Khong phai domain status |
