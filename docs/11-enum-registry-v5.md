# 11 Enum Registry v5

Sinh TU DONG tu `07-openapi-v5.yaml`. Audit: khong co hai enum cung tap gia tri duoi hai ten. Figma: FIGMA_ACCESS_UNVERIFIED.

| Concept | OpenAPI schema | Canonical values | DB field | Ghi chu |
|---|---|---|---|---|
| systemRole | SystemRole | ADMIN, MANAGER, STAFF, CUSTOMER | users.systemRole | Khong co DOCTOR |
| staffSubRole | StaffSubRole | RECEPTIONIST, CARE_STAFF_GROOMER, VETERINARIAN, NURSE | staff_profiles.staffSubRole | Dung chung cho requiredStaffRole |
| serviceType | ServiceType | GROOMING, MEDICAL | services.serviceType; appointments.serviceType | Nguon su that duy nhat. ServiceRecord.serviceType chi la snapshot cua serviceType luc thuc hien |
| bookingMode | BookingMode | BOOKABLE, REQUEST_ONLY, CONTACT_ONLY | services.bookingMode |  |
| depositType | DepositType | NONE, PERCENTAGE | services.depositConfig.depositType | Bat coc => PERCENTAGE, gia tri 30. Khong override |
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
| appointmentPaymentMethod | AppointmentPaymentMethod | ONLINE_MOCK, PAY_AT_STORE | payments.method (target APPOINTMENT) | Khong co COD |
| orderPaymentMethod (inline checkout) | CheckoutRequest.paymentMethod | ONLINE_MOCK, COD | orders.paymentMethod | ONLINE_MOCK, COD. Khong co PAY_AT_STORE |
| paymentKind | PaymentKind | DEPOSIT, BALANCE, ORDER | payments.kind |  |
| depositStatus | DepositStatus | NOT_REQUIRED, PENDING, HELD, APPLIED, REFUNDED, FORFEITED, TRANSFERRED | appointments.deposit.status |  |
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
| fulfillmentIssue | FulfillmentIssue | NOT_FULFILLABLE_BY_SINGLE_BRANCH, FULFILLMENT_NOT_CONFIGURED | (khong luu; tra o checkout quote/validate) | Ket qua resolver |
| errorCode | ErrorCode | VALIDATION_ERROR, AUTHENTICATION_ERROR, AUTHORIZATION_ERROR, OWNERSHIP_ERROR, BRANCH_SCOPE_ERROR, ASSIGNMENT_SCOPE_ERROR, NOT_FOUND, CONFLICT, SLOT_UNAVAILABLE, SHIFT_OVERLAP, IDEMPOTENCY_KEY_REUSED, INVALID_STATE_TRANSITION, RESCHEDULE_TOO_LATE, RESCHEDULE_LIMIT, MIXED_SERVICE_TYPES, INCOMPATIBLE_STAFF_ROLES, SERVICE_NOT_ENABLED_AT_BRANCH, BOOKING_MODE_NOT_ALLOWED, INSUFFICIENT_INVENTORY, PAYMENT_STATE_ERROR, REFUND_STATE_ERROR, RETURN_WINDOW_EXPIRED, RETURN_QTY_EXCEEDS_RETURNABLE, MEDICAL_REVIEW_REQUIRED, EXTERNAL_PROVIDER_ERROR, RATE_LIMIT, INTERNAL_ERROR, PRODUCT_NOT_PURCHASABLE, VOUCHER_INVALID, ORDER_NOT_RETURNABLE, FULFILLMENT_NOT_CONFIGURED | (Problem.code) | RFC 9457 extension |

## Khong dua vao canonical
| Legacy / bi bo | Ly do |
|---|---|
| DOCTOR | thay bang STAFF + VETERINARIAN |
| waiting_store_payment, PARTIALLY_REFUNDED | khong thuoc payment status hien hanh |
| rescheduled, missed | rescheduleCount, NO_SHOW |
| serviceType tren Service/Appointment | chi serviceType; serviceType chi o ServiceRecord (snapshot) |
| FIXED (depositType) | khoa cung: PERCENTAGE 30 |
| Phuong thuc thanh toan chung cho hai target | Moi target co tap rieng: lich hen ONLINE_MOCK/PAY_AT_STORE, don hang ONLINE_MOCK/COD |

Moi concept mot ten; `status` khong dung chung nhieu nghia.
