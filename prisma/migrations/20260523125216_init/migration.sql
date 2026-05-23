-- CreateTable
CREATE TABLE `roles` (
    `role_id` BIGINT NOT NULL AUTO_INCREMENT,
    `role_code` VARCHAR(50) NOT NULL,
    `role_name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `roles_role_code_key`(`role_code`),
    PRIMARY KEY (`role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `user_id` BIGINT NOT NULL AUTO_INCREMENT,
    `role_id` BIGINT NOT NULL,
    `full_name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(150) NULL,
    `phone` VARCHAR(20) NULL,
    `password_hash` VARCHAR(255) NULL,
    `avatar_url` VARCHAR(500) NULL,
    `status` ENUM('active', 'inactive', 'disabled') NOT NULL DEFAULT 'active',
    `failed_login_count` INTEGER NOT NULL DEFAULT 0,
    `terms_accepted_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_phone_key`(`phone`),
    INDEX `idx_users_role_id`(`role_id`),
    INDEX `idx_users_email`(`email`),
    INDEX `idx_users_phone`(`phone`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_providers` (
    `auth_provider_id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `provider_name` ENUM('google', 'facebook') NOT NULL,
    `provider_user_id` VARCHAR(255) NOT NULL,
    `provider_email` VARCHAR(150) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_auth_providers_user_id`(`user_id`),
    UNIQUE INDEX `uq_auth_provider`(`provider_name`, `provider_user_id`),
    PRIMARY KEY (`auth_provider_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `otp_codes` (
    `otp_id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NULL,
    `email` VARCHAR(150) NULL,
    `phone` VARCHAR(20) NULL,
    `otp_code` VARCHAR(10) NOT NULL,
    `purpose` ENUM('register', 'forgot_password', 'change_email', 'change_phone') NOT NULL,
    `expires_at` DATETIME(0) NOT NULL,
    `resend_available_at` DATETIME(0) NULL,
    `used_at` DATETIME(0) NULL,
    `attempt_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_otp_user_id`(`user_id`),
    INDEX `idx_otp_email`(`email`),
    INDEX `idx_otp_phone`(`phone`),
    PRIMARY KEY (`otp_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_sessions` (
    `session_id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `session_token` VARCHAR(255) NOT NULL,
    `remember_me` BOOLEAN NOT NULL DEFAULT false,
    `ip_address` VARCHAR(50) NULL,
    `user_agent` VARCHAR(255) NULL,
    `expires_at` DATETIME(0) NOT NULL,
    `revoked_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `user_sessions_session_token_key`(`session_token`),
    INDEX `idx_sessions_user_id`(`user_id`),
    PRIMARY KEY (`session_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_addresses` (
    `address_id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `recipient_name` VARCHAR(150) NOT NULL,
    `recipient_phone` VARCHAR(20) NOT NULL,
    `address_line` VARCHAR(255) NOT NULL,
    `ward` VARCHAR(100) NULL,
    `district` VARCHAR(100) NULL,
    `province` VARCHAR(100) NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_user_addresses_user_id`(`user_id`),
    PRIMARY KEY (`address_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `notification_id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `notification_type` VARCHAR(100) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `content` TEXT NULL,
    `channel` ENUM('in_app', 'email', 'sms') NOT NULL DEFAULT 'in_app',
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `sent_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_notifications_user_id`(`user_id`),
    PRIMARY KEY (`notification_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pet_species` (
    `species_id` BIGINT NOT NULL AUTO_INCREMENT,
    `species_name` VARCHAR(100) NOT NULL,
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',

    UNIQUE INDEX `pet_species_species_name_key`(`species_name`),
    PRIMARY KEY (`species_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pet_breeds` (
    `breed_id` BIGINT NOT NULL AUTO_INCREMENT,
    `species_id` BIGINT NOT NULL,
    `breed_name` VARCHAR(100) NOT NULL,

    UNIQUE INDEX `uq_pet_breed`(`species_id`, `breed_name`),
    PRIMARY KEY (`breed_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pets` (
    `pet_id` BIGINT NOT NULL AUTO_INCREMENT,
    `owner_user_id` BIGINT NOT NULL,
    `species_id` BIGINT NOT NULL,
    `breed_id` BIGINT NULL,
    `pet_name` VARCHAR(100) NOT NULL,
    `gender` ENUM('male', 'female', 'unknown') NOT NULL DEFAULT 'unknown',
    `birth_date` DATE NULL,
    `weight_kg` DECIMAL(5, 2) NULL,
    `profile_image_url` VARCHAR(500) NULL,
    `health_status` ENUM('healthy', 'treating', 'need_recheck', 'unknown') NOT NULL DEFAULT 'unknown',
    `medical_note` TEXT NULL,
    `next_vaccination_date` DATE NULL,
    `status` ENUM('active', 'deleted') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_pets_owner`(`owner_user_id`),
    INDEX `idx_pets_name`(`pet_name`),
    INDEX `idx_pets_species_id`(`species_id`),
    INDEX `idx_pets_breed_id`(`breed_id`),
    PRIMARY KEY (`pet_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pet_images` (
    `pet_image_id` BIGINT NOT NULL AUTO_INCREMENT,
    `pet_id` BIGINT NOT NULL,
    `image_url` VARCHAR(500) NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_pet_images_pet_id`(`pet_id`),
    PRIMARY KEY (`pet_image_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branches` (
    `branch_id` BIGINT NOT NULL AUTO_INCREMENT,
    `branch_name` VARCHAR(150) NOT NULL,
    `address` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(150) NULL,
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',

    PRIMARY KEY (`branch_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff_profiles` (
    `staff_id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `branch_id` BIGINT NOT NULL,
    `position` VARCHAR(100) NULL,
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',

    UNIQUE INDEX `staff_profiles_user_id_key`(`user_id`),
    INDEX `idx_staff_branch_id`(`branch_id`),
    PRIMARY KEY (`staff_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `doctors` (
    `doctor_id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `branch_id` BIGINT NOT NULL,
    `doctor_name` VARCHAR(150) NULL,
    `bio` TEXT NULL,
    `avatar_url` VARCHAR(500) NULL,
    `average_rating` DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',

    UNIQUE INDEX `doctors_user_id_key`(`user_id`),
    INDEX `idx_doctors_branch_id`(`branch_id`),
    PRIMARY KEY (`doctor_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `specialties` (
    `specialty_id` BIGINT NOT NULL AUTO_INCREMENT,
    `specialty_name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,

    UNIQUE INDEX `specialties_specialty_name_key`(`specialty_name`),
    PRIMARY KEY (`specialty_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `doctor_specialties` (
    `doctor_id` BIGINT NOT NULL,
    `specialty_id` BIGINT NOT NULL,

    PRIMARY KEY (`doctor_id`, `specialty_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `time_slots` (
    `slot_id` BIGINT NOT NULL AUTO_INCREMENT,
    `doctor_id` BIGINT NULL,
    `branch_id` BIGINT NOT NULL,
    `slot_date` DATE NOT NULL,
    `start_time` TIME(0) NOT NULL,
    `end_time` TIME(0) NOT NULL,
    `max_booking` INTEGER NOT NULL DEFAULT 1,
    `booked_count` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('available', 'full', 'locked', 'inactive') NOT NULL DEFAULT 'available',

    INDEX `idx_time_slots_doctor_id`(`doctor_id`),
    INDEX `idx_time_slots_branch_id`(`branch_id`),
    PRIMARY KEY (`slot_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_categories` (
    `service_category_id` BIGINT NOT NULL AUTO_INCREMENT,
    `category_name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',

    UNIQUE INDEX `service_categories_category_name_key`(`category_name`),
    PRIMARY KEY (`service_category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `services` (
    `service_id` BIGINT NOT NULL AUTO_INCREMENT,
    `service_category_id` BIGINT NOT NULL,
    `service_name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `base_price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `duration_minutes` INTEGER NOT NULL DEFAULT 30,
    `image_url` VARCHAR(500) NULL,
    `average_rating` DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',

    INDEX `idx_services_category_id`(`service_category_id`),
    PRIMARY KEY (`service_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_surcharges` (
    `surcharge_id` BIGINT NOT NULL AUTO_INCREMENT,
    `service_id` BIGINT NOT NULL,
    `condition_type` ENUM('age', 'weight', 'other') NOT NULL,
    `min_value` DECIMAL(10, 2) NULL,
    `max_value` DECIMAL(10, 2) NULL,
    `surcharge_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `description` VARCHAR(255) NULL,

    INDEX `idx_surcharges_service_id`(`service_id`),
    PRIMARY KEY (`surcharge_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `appointments` (
    `appointment_id` BIGINT NOT NULL AUTO_INCREMENT,
    `appointment_code` VARCHAR(50) NOT NULL,
    `user_id` BIGINT NOT NULL,
    `pet_id` BIGINT NULL,
    `branch_id` BIGINT NOT NULL,
    `doctor_id` BIGINT NULL,
    `slot_id` BIGINT NOT NULL,
    `customer_name_snapshot` VARCHAR(150) NOT NULL,
    `customer_phone_snapshot` VARCHAR(20) NULL,
    `pet_name_snapshot` VARCHAR(100) NULL,
    `pet_species_snapshot` VARCHAR(100) NULL,
    `pet_breed_snapshot` VARCHAR(100) NULL,
    `appointment_date` DATE NOT NULL,
    `start_time` TIME(0) NOT NULL,
    `note` TEXT NULL,
    `condition_description` TEXT NULL,
    `status` ENUM('pending', 'confirmed', 'completed', 'cancelled', 'rescheduled') NOT NULL DEFAULT 'pending',
    `payment_status` ENUM('unpaid', 'waiting_store_payment', 'paid', 'refunded', 'failed') NOT NULL DEFAULT 'unpaid',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `appointments_appointment_code_key`(`appointment_code`),
    INDEX `idx_appointments_user`(`user_id`),
    INDEX `idx_appointments_pet`(`pet_id`),
    INDEX `idx_appointments_date`(`appointment_date`),
    INDEX `idx_appointments_status`(`status`),
    INDEX `idx_appointments_payment_status`(`payment_status`),
    INDEX `idx_appointments_branch_id`(`branch_id`),
    INDEX `idx_appointments_doctor_id`(`doctor_id`),
    INDEX `idx_appointments_slot_id`(`slot_id`),
    PRIMARY KEY (`appointment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `appointment_services` (
    `appointment_service_id` BIGINT NOT NULL AUTO_INCREMENT,
    `appointment_id` BIGINT NOT NULL,
    `service_id` BIGINT NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unit_price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `surcharge_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `total_price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,

    INDEX `idx_appointment_services_appointment_id`(`appointment_id`),
    INDEX `idx_appointment_services_service_id`(`service_id`),
    PRIMARY KEY (`appointment_service_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `appointment_status_history` (
    `history_id` BIGINT NOT NULL AUTO_INCREMENT,
    `appointment_id` BIGINT NOT NULL,
    `old_status` VARCHAR(50) NULL,
    `new_status` VARCHAR(50) NOT NULL,
    `changed_by_user_id` BIGINT NULL,
    `reason` TEXT NULL,
    `changed_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_appointment_history_appointment_id`(`appointment_id`),
    INDEX `idx_appointment_history_user_id`(`changed_by_user_id`),
    PRIMARY KEY (`history_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medical_records` (
    `medical_record_id` BIGINT NOT NULL AUTO_INCREMENT,
    `pet_id` BIGINT NOT NULL,
    `appointment_id` BIGINT NULL,
    `doctor_id` BIGINT NULL,
    `record_name` VARCHAR(255) NOT NULL,
    `visit_date` DATE NOT NULL,
    `symptoms` TEXT NULL,
    `diagnosis` TEXT NULL,
    `treatment_note` TEXT NULL,
    `created_by_user_id` BIGINT NOT NULL,
    `source_type` ENUM('doctor_created', 'user_uploaded', 'system_imported') NOT NULL DEFAULT 'doctor_created',
    `is_locked_for_customer` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_medical_records_pet_date`(`pet_id`, `visit_date`),
    INDEX `idx_medical_records_appointment_id`(`appointment_id`),
    INDEX `idx_medical_records_doctor_id`(`doctor_id`),
    INDEX `idx_medical_records_created_by_user_id`(`created_by_user_id`),
    PRIMARY KEY (`medical_record_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medical_record_attachments` (
    `attachment_id` BIGINT NOT NULL AUTO_INCREMENT,
    `medical_record_id` BIGINT NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `file_type` VARCHAR(50) NOT NULL,
    `file_size_kb` INTEGER NULL,
    `uploaded_by_user_id` BIGINT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_medical_attachments_record_id`(`medical_record_id`),
    INDEX `idx_medical_attachments_user_id`(`uploaded_by_user_id`),
    PRIMARY KEY (`attachment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prescriptions` (
    `prescription_id` BIGINT NOT NULL AUTO_INCREMENT,
    `medical_record_id` BIGINT NOT NULL,
    `doctor_id` BIGINT NULL,
    `note` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_prescriptions_record_id`(`medical_record_id`),
    INDEX `idx_prescriptions_doctor_id`(`doctor_id`),
    PRIMARY KEY (`prescription_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prescription_items` (
    `prescription_item_id` BIGINT NOT NULL AUTO_INCREMENT,
    `prescription_id` BIGINT NOT NULL,
    `medicine_name` VARCHAR(150) NOT NULL,
    `dosage` VARCHAR(100) NULL,
    `frequency` VARCHAR(100) NULL,
    `duration` VARCHAR(100) NULL,
    `instruction` TEXT NULL,

    INDEX `idx_prescription_items_prescription_id`(`prescription_id`),
    PRIMARY KEY (`prescription_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pet_vaccination_history` (
    `vaccination_id` BIGINT NOT NULL AUTO_INCREMENT,
    `pet_id` BIGINT NOT NULL,
    `vaccine_name` VARCHAR(150) NOT NULL,
    `vaccinated_date` DATE NULL,
    `next_due_date` DATE NULL,
    `doctor_id` BIGINT NULL,
    `note` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_vaccination_pet_id`(`pet_id`),
    INDEX `idx_vaccination_doctor_id`(`doctor_id`),
    PRIMARY KEY (`vaccination_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `health_diary_entries` (
    `diary_entry_id` BIGINT NOT NULL AUTO_INCREMENT,
    `pet_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `entry_date` DATE NOT NULL,
    `entry_time` TIME(0) NULL,
    `icon_code` VARCHAR(50) NULL,
    `color_code` VARCHAR(20) NULL,
    `title` VARCHAR(150) NOT NULL,
    `content` TEXT NULL,
    `status` ENUM('active', 'deleted') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_diary_pet_date`(`pet_id`, `entry_date`),
    INDEX `idx_diary_user_id`(`user_id`),
    PRIMARY KEY (`diary_entry_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `health_diary_attachments` (
    `attachment_id` BIGINT NOT NULL AUTO_INCREMENT,
    `diary_entry_id` BIGINT NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `file_type` VARCHAR(50) NOT NULL,
    `file_size_kb` INTEGER NULL,
    `attachment_group` ENUM('medical_file', 'invoice', 'other') NOT NULL DEFAULT 'other',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_diary_attachments_entry_id`(`diary_entry_id`),
    PRIMARY KEY (`attachment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pet_reminders` (
    `reminder_id` BIGINT NOT NULL AUTO_INCREMENT,
    `pet_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `reminder_type` ENUM('vaccination', 'deworming', 'routine_checkup', 'other') NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `remind_date` DATE NOT NULL,
    `remind_before_days` INTEGER NOT NULL DEFAULT 3,
    `note` TEXT NULL,
    `status` ENUM('pending', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    `completed_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_reminders_pet_id`(`pet_id`),
    INDEX `idx_reminders_user_id`(`user_id`),
    PRIMARY KEY (`reminder_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_categories` (
    `product_category_id` BIGINT NOT NULL AUTO_INCREMENT,
    `parent_id` BIGINT NULL,
    `category_name` VARCHAR(150) NOT NULL,
    `image_url` VARCHAR(500) NULL,
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',

    INDEX `idx_product_categories_parent_id`(`parent_id`),
    PRIMARY KEY (`product_category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `product_id` BIGINT NOT NULL AUTO_INCREMENT,
    `product_category_id` BIGINT NOT NULL,
    `product_name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `stock_quantity` INTEGER NOT NULL DEFAULT 0,
    `average_rating` DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
    `status` ENUM('active', 'inactive', 'out_of_stock') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_products_name`(`product_name`),
    INDEX `idx_products_category`(`product_category_id`),
    INDEX `idx_products_status`(`status`),
    PRIMARY KEY (`product_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_images` (
    `product_image_id` BIGINT NOT NULL AUTO_INCREMENT,
    `product_id` BIGINT NOT NULL,
    `image_url` VARCHAR(500) NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_product_images_product_id`(`product_id`),
    PRIMARY KEY (`product_image_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carts` (
    `cart_id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `status` ENUM('active', 'checked_out', 'abandoned') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_carts_user_id`(`user_id`),
    PRIMARY KEY (`cart_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cart_items` (
    `cart_item_id` BIGINT NOT NULL AUTO_INCREMENT,
    `cart_id` BIGINT NOT NULL,
    `product_id` BIGINT NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unit_price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `is_selected` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_cart_items_cart_id`(`cart_id`),
    INDEX `idx_cart_items_product_id`(`product_id`),
    PRIMARY KEY (`cart_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vouchers` (
    `voucher_id` BIGINT NOT NULL AUTO_INCREMENT,
    `voucher_code` VARCHAR(50) NOT NULL,
    `voucher_name` VARCHAR(150) NOT NULL,
    `discount_type` ENUM('percent', 'fixed') NOT NULL,
    `discount_value` DECIMAL(12, 2) NOT NULL,
    `max_discount_amount` DECIMAL(12, 2) NULL,
    `min_order_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `target_type` ENUM('all', 'order', 'appointment') NOT NULL DEFAULT 'all',
    `start_at` DATETIME(0) NOT NULL,
    `end_at` DATETIME(0) NOT NULL,
    `total_usage_limit` INTEGER NULL,
    `remaining_usage` INTEGER NULL,
    `status` ENUM('active', 'inactive', 'expired') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `vouchers_voucher_code_key`(`voucher_code`),
    PRIMARY KEY (`voucher_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `order_id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_code` VARCHAR(50) NOT NULL,
    `order_type` ENUM('product', 'appointment') NOT NULL DEFAULT 'product',
    `user_id` BIGINT NOT NULL,
    `appointment_id` BIGINT NULL,
    `address_id` BIGINT NULL,
    `voucher_id` BIGINT NULL,
    `recipient_name` VARCHAR(150) NULL,
    `recipient_phone` VARCHAR(20) NULL,
    `shipping_address` VARCHAR(255) NULL,
    `subtotal_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `points_discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `shipping_fee` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `total_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `order_status` ENUM('pending', 'confirmed', 'shipping', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    `payment_status` ENUM('unpaid', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'unpaid',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `orders_order_code_key`(`order_code`),
    INDEX `idx_orders_user`(`user_id`),
    INDEX `idx_orders_status`(`order_status`),
    INDEX `idx_orders_appointment_id`(`appointment_id`),
    INDEX `idx_orders_address_id`(`address_id`),
    INDEX `idx_orders_voucher_id`(`voucher_id`),
    PRIMARY KEY (`order_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `order_item_id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT NOT NULL,
    `product_id` BIGINT NULL,
    `service_id` BIGINT NULL,
    `item_type` ENUM('product', 'service') NOT NULL DEFAULT 'product',
    `item_name_snapshot` VARCHAR(200) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unit_price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `total_price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,

    INDEX `idx_order_items_order_id`(`order_id`),
    INDEX `idx_order_items_product_id`(`product_id`),
    INDEX `idx_order_items_service_id`(`service_id`),
    PRIMARY KEY (`order_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_status_history` (
    `history_id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT NOT NULL,
    `old_status` VARCHAR(50) NULL,
    `new_status` VARCHAR(50) NOT NULL,
    `changed_by_user_id` BIGINT NULL,
    `note` TEXT NULL,
    `changed_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_order_history_order_id`(`order_id`),
    INDEX `idx_order_history_user_id`(`changed_by_user_id`),
    PRIMARY KEY (`history_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `payment_id` BIGINT NOT NULL AUTO_INCREMENT,
    `payment_code` VARCHAR(50) NOT NULL,
    `user_id` BIGINT NOT NULL,
    `order_id` BIGINT NOT NULL,
    `appointment_id` BIGINT NULL,
    `payment_target_type` ENUM('order', 'appointment') NOT NULL DEFAULT 'order',
    `payment_method` ENUM('cod', 'online', 'store') NOT NULL,
    `payment_gateway` VARCHAR(100) NULL,
    `gateway_transaction_id` VARCHAR(255) NULL,
    `subtotal_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `voucher_discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `points_used` INTEGER NOT NULL DEFAULT 0,
    `points_discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `final_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `status` ENUM('pending', 'waiting_store_payment', 'paid', 'failed', 'refunded', 'cancelled') NOT NULL DEFAULT 'pending',
    `confirmed_by_staff_id` BIGINT NULL,
    `paid_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `payments_payment_code_key`(`payment_code`),
    INDEX `idx_payments_user`(`user_id`),
    INDEX `idx_payments_order`(`order_id`),
    INDEX `idx_payments_status`(`status`),
    INDEX `idx_payments_appointment_id`(`appointment_id`),
    INDEX `idx_payments_staff_id`(`confirmed_by_staff_id`),
    PRIMARY KEY (`payment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receipts` (
    `receipt_id` BIGINT NOT NULL AUTO_INCREMENT,
    `payment_id` BIGINT NOT NULL,
    `receipt_code` VARCHAR(50) NOT NULL,
    `receipt_url` VARCHAR(500) NULL,
    `issued_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_by_user_id` BIGINT NULL,

    UNIQUE INDEX `receipts_payment_id_key`(`payment_id`),
    UNIQUE INDEX `receipts_receipt_code_key`(`receipt_code`),
    INDEX `idx_receipts_creator_id`(`created_by_user_id`),
    PRIMARY KEY (`receipt_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refunds` (
    `refund_id` BIGINT NOT NULL AUTO_INCREMENT,
    `payment_id` BIGINT NOT NULL,
    `refund_code` VARCHAR(50) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `reason` TEXT NULL,
    `status` ENUM('requested', 'processing', 'completed', 'rejected') NOT NULL DEFAULT 'requested',
    `processed_by_user_id` BIGINT NULL,
    `processed_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `refunds_refund_code_key`(`refund_code`),
    INDEX `idx_refunds_payment_id`(`payment_id`),
    INDEX `idx_refunds_processor_id`(`processed_by_user_id`),
    PRIMARY KEY (`refund_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `voucher_usages` (
    `voucher_usage_id` BIGINT NOT NULL AUTO_INCREMENT,
    `voucher_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `payment_id` BIGINT NOT NULL,
    `discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `used_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_voucher_usages_voucher_id`(`voucher_id`),
    INDEX `idx_voucher_usages_user_id`(`user_id`),
    INDEX `idx_voucher_usages_payment_id`(`payment_id`),
    PRIMARY KEY (`voucher_usage_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loyalty_accounts` (
    `loyalty_account_id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `current_points` INTEGER NOT NULL DEFAULT 0,
    `lifetime_points` INTEGER NOT NULL DEFAULT 0,
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `loyalty_accounts_user_id_key`(`user_id`),
    PRIMARY KEY (`loyalty_account_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loyalty_point_transactions` (
    `point_transaction_id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `payment_id` BIGINT NULL,
    `transaction_type` ENUM('earn', 'redeem', 'refund', 'adjust') NOT NULL,
    `points` INTEGER NOT NULL,
    `money_value` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `description` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_loyalty_transactions_user_id`(`user_id`),
    INDEX `idx_loyalty_transactions_payment_id`(`payment_id`),
    PRIMARY KEY (`point_transaction_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviews` (
    `review_id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `target_type` ENUM('product', 'service') NOT NULL,
    `target_id` BIGINT NOT NULL,
    `order_id` BIGINT NULL,
    `rating` TINYINT NOT NULL,
    `comment` TEXT NULL,
    `status` ENUM('posted', 'rejected', 'deleted') NOT NULL DEFAULT 'posted',
    `admin_note` TEXT NULL,
    `reviewed_by_admin_id` BIGINT NULL,
    `reviewed_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_reviews_target`(`target_type`, `target_id`),
    INDEX `idx_reviews_user_id`(`user_id`),
    INDEX `idx_reviews_order_id`(`order_id`),
    INDEX `idx_reviews_admin_id`(`reviewed_by_admin_id`),
    PRIMARY KEY (`review_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `review_images` (
    `review_image_id` BIGINT NOT NULL AUTO_INCREMENT,
    `review_id` BIGINT NOT NULL,
    `image_url` VARCHAR(500) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_review_images_review_id`(`review_id`),
    PRIMARY KEY (`review_image_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `post_categories` (
    `post_category_id` BIGINT NOT NULL AUTO_INCREMENT,
    `category_name` VARCHAR(150) NOT NULL,
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',

    UNIQUE INDEX `post_categories_category_name_key`(`category_name`),
    PRIMARY KEY (`post_category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `posts` (
    `post_id` BIGINT NOT NULL AUTO_INCREMENT,
    `post_category_id` BIGINT NOT NULL,
    `author_user_id` BIGINT NOT NULL,
    `post_type` ENUM('official_blog', 'community') NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `thumbnail_url` VARCHAR(500) NULL,
    `content` LONGTEXT NULL,
    `status` ENUM('draft', 'published', 'hidden', 'deleted') NOT NULL DEFAULT 'draft',
    `view_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `posts_slug_key`(`slug`),
    INDEX `idx_posts_category_id`(`post_category_id`),
    INDEX `idx_posts_author_id`(`author_user_id`),
    PRIMARY KEY (`post_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `post_comments` (
    `comment_id` BIGINT NOT NULL AUTO_INCREMENT,
    `post_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `parent_comment_id` BIGINT NULL,
    `content` TEXT NOT NULL,
    `status` ENUM('visible', 'hidden', 'deleted') NOT NULL DEFAULT 'visible',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_post_comments_post_id`(`post_id`),
    INDEX `idx_post_comments_user_id`(`user_id`),
    INDEX `idx_post_comments_parent_id`(`parent_comment_id`),
    PRIMARY KEY (`comment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `first_aid_categories` (
    `first_aid_category_id` BIGINT NOT NULL AUTO_INCREMENT,
    `category_name` VARCHAR(150) NOT NULL,
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',

    UNIQUE INDEX `first_aid_categories_category_name_key`(`category_name`),
    PRIMARY KEY (`first_aid_category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `first_aid_guides` (
    `guide_id` BIGINT NOT NULL AUTO_INCREMENT,
    `first_aid_category_id` BIGINT NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `situation_description` TEXT NOT NULL,
    `emergency_phone` VARCHAR(20) NULL,
    `video_url` VARCHAR(500) NULL,
    `status` ENUM('published', 'hidden', 'deleted') NOT NULL DEFAULT 'published',
    `created_by_admin_id` BIGINT NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_first_aid_guides_category_id`(`first_aid_category_id`),
    INDEX `idx_first_aid_guides_admin_id`(`created_by_admin_id`),
    PRIMARY KEY (`guide_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `first_aid_steps` (
    `step_id` BIGINT NOT NULL AUTO_INCREMENT,
    `guide_id` BIGINT NOT NULL,
    `step_number` INTEGER NOT NULL,
    `step_content` TEXT NOT NULL,
    `image_url` VARCHAR(500) NULL,

    INDEX `idx_first_aid_steps_guide_id`(`guide_id`),
    PRIMARY KEY (`step_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `first_aid_media` (
    `media_id` BIGINT NOT NULL AUTO_INCREMENT,
    `guide_id` BIGINT NOT NULL,
    `media_type` ENUM('image', 'video') NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `file_size_kb` INTEGER NULL,

    INDEX `idx_first_aid_media_guide_id`(`guide_id`),
    PRIMARY KEY (`media_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rescue_posts` (
    `rescue_post_id` BIGINT NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `content` LONGTEXT NULL,
    `thumbnail_url` VARCHAR(500) NULL,
    `contact_phone` VARCHAR(20) NULL,
    `external_link` VARCHAR(500) NULL,
    `status` ENUM('published', 'hidden', 'deleted') NOT NULL DEFAULT 'published',
    `created_by_admin_id` BIGINT NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_rescue_posts_admin_id`(`created_by_admin_id`),
    PRIMARY KEY (`rescue_post_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rescue_stations` (
    `station_id` BIGINT NOT NULL AUTO_INCREMENT,
    `station_name` VARCHAR(150) NOT NULL,
    `address` VARCHAR(255) NULL,
    `phone` VARCHAR(20) NULL,
    `fanpage_url` VARCHAR(500) NULL,
    `donation_url` VARCHAR(500) NULL,
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',

    PRIMARY KEY (`station_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `adoption_pets` (
    `adoption_pet_id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `species` VARCHAR(100) NULL,
    `age_text` VARCHAR(100) NULL,
    `region` VARCHAR(150) NULL,
    `personality` TEXT NULL,
    `description` TEXT NULL,
    `adoption_conditions` TEXT NULL,
    `status` ENUM('available', 'adopted', 'hidden') NOT NULL DEFAULT 'available',
    `created_by_admin_id` BIGINT NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_adoption_pets_admin_id`(`created_by_admin_id`),
    PRIMARY KEY (`adoption_pet_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `adoption_pet_images` (
    `image_id` BIGINT NOT NULL AUTO_INCREMENT,
    `adoption_pet_id` BIGINT NOT NULL,
    `image_url` VARCHAR(500) NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,

    INDEX `idx_adoption_pet_images_pet_id`(`adoption_pet_id`),
    PRIMARY KEY (`image_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `adoption_requests` (
    `adoption_request_id` BIGINT NOT NULL AUTO_INCREMENT,
    `adoption_pet_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `full_name` VARCHAR(150) NOT NULL,
    `address` VARCHAR(255) NOT NULL,
    `reason` TEXT NOT NULL,
    `housing_info` TEXT NULL,
    `experience` TEXT NULL,
    `status` ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    `rejection_reason` TEXT NULL,
    `reviewed_by_admin_id` BIGINT NULL,
    `reviewed_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_adoption_requests_pet_id`(`adoption_pet_id`),
    INDEX `idx_adoption_requests_user_id`(`user_id`),
    INDEX `idx_adoption_requests_admin_id`(`reviewed_by_admin_id`),
    PRIMARY KEY (`adoption_request_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_chat_sessions` (
    `ai_session_id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `pet_id` BIGINT NULL,
    `ad_hoc_pet_info` TEXT NULL,
    `session_type` ENUM('general', 'symptom') NOT NULL DEFAULT 'symptom',
    `disclaimer_shown` BOOLEAN NOT NULL DEFAULT true,
    `started_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `expires_at` DATETIME(0) NULL,
    `status` ENUM('active', 'closed', 'expired') NOT NULL DEFAULT 'active',

    INDEX `idx_ai_sessions_user_id`(`user_id`),
    INDEX `idx_ai_sessions_pet_id`(`pet_id`),
    PRIMARY KEY (`ai_session_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_chat_messages` (
    `ai_message_id` BIGINT NOT NULL AUTO_INCREMENT,
    `ai_session_id` BIGINT NOT NULL,
    `sender_type` ENUM('user', 'ai', 'system') NOT NULL,
    `message_text` TEXT NOT NULL,
    `is_emergency_warning` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_ai_messages_session_id`(`ai_session_id`),
    PRIMARY KEY (`ai_message_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `search_logs` (
    `search_log_id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NULL,
    `keyword` VARCHAR(255) NOT NULL,
    `search_scope` ENUM('all', 'product', 'service', 'appointment', 'blog', 'rescue', 'adoption') NOT NULL DEFAULT 'all',
    `filters_json` JSON NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_search_logs_user`(`user_id`),
    PRIMARY KEY (`search_log_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`role_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auth_providers` ADD CONSTRAINT `auth_providers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `otp_codes` ADD CONSTRAINT `otp_codes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_addresses` ADD CONSTRAINT `user_addresses_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pet_breeds` ADD CONSTRAINT `pet_breeds_species_id_fkey` FOREIGN KEY (`species_id`) REFERENCES `pet_species`(`species_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pets` ADD CONSTRAINT `pets_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pets` ADD CONSTRAINT `pets_species_id_fkey` FOREIGN KEY (`species_id`) REFERENCES `pet_species`(`species_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pets` ADD CONSTRAINT `pets_breed_id_fkey` FOREIGN KEY (`breed_id`) REFERENCES `pet_breeds`(`breed_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pet_images` ADD CONSTRAINT `pet_images_pet_id_fkey` FOREIGN KEY (`pet_id`) REFERENCES `pets`(`pet_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_profiles` ADD CONSTRAINT `staff_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_profiles` ADD CONSTRAINT `staff_profiles_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`branch_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `doctors` ADD CONSTRAINT `doctors_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `doctors` ADD CONSTRAINT `doctors_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`branch_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `doctor_specialties` ADD CONSTRAINT `doctor_specialties_doctor_id_fkey` FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`doctor_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `doctor_specialties` ADD CONSTRAINT `doctor_specialties_specialty_id_fkey` FOREIGN KEY (`specialty_id`) REFERENCES `specialties`(`specialty_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `time_slots` ADD CONSTRAINT `time_slots_doctor_id_fkey` FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`doctor_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `time_slots` ADD CONSTRAINT `time_slots_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`branch_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `services` ADD CONSTRAINT `services_service_category_id_fkey` FOREIGN KEY (`service_category_id`) REFERENCES `service_categories`(`service_category_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_surcharges` ADD CONSTRAINT `service_surcharges_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`service_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_pet_id_fkey` FOREIGN KEY (`pet_id`) REFERENCES `pets`(`pet_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`branch_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_doctor_id_fkey` FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`doctor_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_slot_id_fkey` FOREIGN KEY (`slot_id`) REFERENCES `time_slots`(`slot_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment_services` ADD CONSTRAINT `appointment_services_appointment_id_fkey` FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`appointment_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment_services` ADD CONSTRAINT `appointment_services_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`service_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment_status_history` ADD CONSTRAINT `appointment_status_history_appointment_id_fkey` FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`appointment_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment_status_history` ADD CONSTRAINT `appointment_status_history_changed_by_user_id_fkey` FOREIGN KEY (`changed_by_user_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medical_records` ADD CONSTRAINT `medical_records_pet_id_fkey` FOREIGN KEY (`pet_id`) REFERENCES `pets`(`pet_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medical_records` ADD CONSTRAINT `medical_records_appointment_id_fkey` FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`appointment_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medical_records` ADD CONSTRAINT `medical_records_doctor_id_fkey` FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`doctor_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medical_records` ADD CONSTRAINT `medical_records_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medical_record_attachments` ADD CONSTRAINT `medical_record_attachments_medical_record_id_fkey` FOREIGN KEY (`medical_record_id`) REFERENCES `medical_records`(`medical_record_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medical_record_attachments` ADD CONSTRAINT `medical_record_attachments_uploaded_by_user_id_fkey` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescriptions` ADD CONSTRAINT `prescriptions_medical_record_id_fkey` FOREIGN KEY (`medical_record_id`) REFERENCES `medical_records`(`medical_record_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescriptions` ADD CONSTRAINT `prescriptions_doctor_id_fkey` FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`doctor_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescription_items` ADD CONSTRAINT `prescription_items_prescription_id_fkey` FOREIGN KEY (`prescription_id`) REFERENCES `prescriptions`(`prescription_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pet_vaccination_history` ADD CONSTRAINT `pet_vaccination_history_pet_id_fkey` FOREIGN KEY (`pet_id`) REFERENCES `pets`(`pet_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pet_vaccination_history` ADD CONSTRAINT `pet_vaccination_history_doctor_id_fkey` FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`doctor_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_diary_entries` ADD CONSTRAINT `health_diary_entries_pet_id_fkey` FOREIGN KEY (`pet_id`) REFERENCES `pets`(`pet_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_diary_entries` ADD CONSTRAINT `health_diary_entries_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_diary_attachments` ADD CONSTRAINT `health_diary_attachments_diary_entry_id_fkey` FOREIGN KEY (`diary_entry_id`) REFERENCES `health_diary_entries`(`diary_entry_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pet_reminders` ADD CONSTRAINT `pet_reminders_pet_id_fkey` FOREIGN KEY (`pet_id`) REFERENCES `pets`(`pet_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pet_reminders` ADD CONSTRAINT `pet_reminders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_categories` ADD CONSTRAINT `product_categories_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `product_categories`(`product_category_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_product_category_id_fkey` FOREIGN KEY (`product_category_id`) REFERENCES `product_categories`(`product_category_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carts` ADD CONSTRAINT `carts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_cart_id_fkey` FOREIGN KEY (`cart_id`) REFERENCES `carts`(`cart_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_appointment_id_fkey` FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`appointment_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_address_id_fkey` FOREIGN KEY (`address_id`) REFERENCES `user_addresses`(`address_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_voucher_id_fkey` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers`(`voucher_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`service_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_status_history` ADD CONSTRAINT `order_status_history_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_status_history` ADD CONSTRAINT `order_status_history_changed_by_user_id_fkey` FOREIGN KEY (`changed_by_user_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_appointment_id_fkey` FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`appointment_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_confirmed_by_staff_id_fkey` FOREIGN KEY (`confirmed_by_staff_id`) REFERENCES `staff_profiles`(`staff_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipts` ADD CONSTRAINT `receipts_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`payment_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipts` ADD CONSTRAINT `receipts_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`payment_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_processed_by_user_id_fkey` FOREIGN KEY (`processed_by_user_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voucher_usages` ADD CONSTRAINT `voucher_usages_voucher_id_fkey` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers`(`voucher_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voucher_usages` ADD CONSTRAINT `voucher_usages_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voucher_usages` ADD CONSTRAINT `voucher_usages_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`payment_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loyalty_accounts` ADD CONSTRAINT `loyalty_accounts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loyalty_point_transactions` ADD CONSTRAINT `loyalty_point_transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loyalty_point_transactions` ADD CONSTRAINT `loyalty_point_transactions_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`payment_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_reviewed_by_admin_id_fkey` FOREIGN KEY (`reviewed_by_admin_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_images` ADD CONSTRAINT `review_images_review_id_fkey` FOREIGN KEY (`review_id`) REFERENCES `reviews`(`review_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posts` ADD CONSTRAINT `posts_post_category_id_fkey` FOREIGN KEY (`post_category_id`) REFERENCES `post_categories`(`post_category_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posts` ADD CONSTRAINT `posts_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `post_comments` ADD CONSTRAINT `post_comments_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `posts`(`post_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `post_comments` ADD CONSTRAINT `post_comments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `post_comments` ADD CONSTRAINT `post_comments_parent_comment_id_fkey` FOREIGN KEY (`parent_comment_id`) REFERENCES `post_comments`(`comment_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `first_aid_guides` ADD CONSTRAINT `first_aid_guides_first_aid_category_id_fkey` FOREIGN KEY (`first_aid_category_id`) REFERENCES `first_aid_categories`(`first_aid_category_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `first_aid_guides` ADD CONSTRAINT `first_aid_guides_created_by_admin_id_fkey` FOREIGN KEY (`created_by_admin_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `first_aid_steps` ADD CONSTRAINT `first_aid_steps_guide_id_fkey` FOREIGN KEY (`guide_id`) REFERENCES `first_aid_guides`(`guide_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `first_aid_media` ADD CONSTRAINT `first_aid_media_guide_id_fkey` FOREIGN KEY (`guide_id`) REFERENCES `first_aid_guides`(`guide_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rescue_posts` ADD CONSTRAINT `rescue_posts_created_by_admin_id_fkey` FOREIGN KEY (`created_by_admin_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adoption_pets` ADD CONSTRAINT `adoption_pets_created_by_admin_id_fkey` FOREIGN KEY (`created_by_admin_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adoption_pet_images` ADD CONSTRAINT `adoption_pet_images_adoption_pet_id_fkey` FOREIGN KEY (`adoption_pet_id`) REFERENCES `adoption_pets`(`adoption_pet_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adoption_requests` ADD CONSTRAINT `adoption_requests_adoption_pet_id_fkey` FOREIGN KEY (`adoption_pet_id`) REFERENCES `adoption_pets`(`adoption_pet_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adoption_requests` ADD CONSTRAINT `adoption_requests_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adoption_requests` ADD CONSTRAINT `adoption_requests_reviewed_by_admin_id_fkey` FOREIGN KEY (`reviewed_by_admin_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_chat_sessions` ADD CONSTRAINT `ai_chat_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_chat_sessions` ADD CONSTRAINT `ai_chat_sessions_pet_id_fkey` FOREIGN KEY (`pet_id`) REFERENCES `pets`(`pet_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_chat_messages` ADD CONSTRAINT `ai_chat_messages_ai_session_id_fkey` FOREIGN KEY (`ai_session_id`) REFERENCES `ai_chat_sessions`(`ai_session_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `search_logs` ADD CONSTRAINT `search_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;
