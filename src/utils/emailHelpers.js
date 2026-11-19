import nodemailer from 'nodemailer';
require('dotenv').config();

const createTransporter = () => {
  const user = process.env.SMTP_USER || process.env.EMAIL_APP || '';
  const pass = process.env.SMTP_PASS || process.env.EMAIL_APP_PASSWORD || '';
  const host = process.env.SMTP_HOST || '';

  if (host) {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
};

const getFromAddress = (displayName = "Dr. Pet's House Clinic") => {
  if (process.env.SMTP_FROM) return process.env.SMTP_FROM;
  const sender = process.env.SMTP_USER || process.env.EMAIL_APP || 'support@drpets.vn';
  return `"${displayName}" <${sender}>`;
};

export const sendOtpEmail = async (toEmail, otpCode, purpose = 'FORGOT_PASSWORD', fullName = '') => {
  const transporter = createTransporter();

  let purposeTitle = 'Xác Nhận OTP';
  let purposeDesc = 'Bạn vừa thực hiện yêu cầu xác thực tại Dr. Pet\'s House. Vui lòng sử dụng mã OTP bên dưới:';

  if (purpose === 'REGISTER') {
    purposeTitle = 'Xác Thực Đăng Ký Tài Khoản';
    purposeDesc = 'Cảm ơn bạn đã đăng ký tài khoản tại Dr. Pet\'s House. Vui lòng sử dụng mã OTP bên dưới để hoàn tất xác thực tài khoản:';
  } else if (purpose === 'FORGOT_PASSWORD') {
    purposeTitle = 'Khôi Phục Mật Khẩu';
    purposeDesc = 'Bạn đã yêu cầu khôi phục mật khẩu tài khoản tại Dr. Pet\'s House. Vui lòng sử dụng mã OTP bên dưới để thiết lập mật khẩu mới:';
  } else if (purpose === 'GUEST_LOOKUP') {
    purposeTitle = 'Tra Cứu Hồ Sơ Khách Vãng Lai';
    purposeDesc = 'Bạn đang thực hiện tra cứu lịch sử khám bệnh và đơn hàng tại Dr. Pet\'s House. Vui lòng nhập mã OTP dưới đây:';
  } else if (purpose === 'ACTIVATION') {
    purposeTitle = 'Kích Hoạt Tài Khoản Khách Hàng';
    purposeDesc = 'Vui lòng sử dụng mã OTP dưới đây để hoàn tất kích hoạt tài khoản tại Dr. Pet\'s House:';
  }

  const greeting = fullName ? `Chào ${fullName},` : 'Chào Quý khách,';

  const mailOptions = {
    from: getFromAddress("Dr. Pet's House Clinic"),
    to: toEmail,
    subject: `[DRPETSHOUSE] Mã xác nhận OTP: ${otpCode} - Dr. Pet's House`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="background-color: #1e3a8a; padding: 24px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">🐾 Dr. Pet's House</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #93c5fd; letter-spacing: 1px; text-transform: uppercase;">SMS BrandName & Email OTP Verification</p>
        </div>
        <div style="padding: 28px 24px;">
          <h2 style="color: #1e293b; font-size: 20px; font-weight: 600; margin-top: 0; text-align: center;">${purposeTitle}</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 8px;">${greeting}</p>
          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-top: 0;">${purposeDesc}</p>
          
          <div style="background: linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%); padding: 20px; text-align: center; border-radius: 8px; margin: 24px 0; border: 2px dashed #3b82f6;">
            <span style="display: block; font-size: 12px; font-weight: 600; color: #1e3a8a; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px;">Thương Hiệu: DRPETSHOUSE</span>
            <div style="font-size: 32px; font-weight: 800; color: #2563eb; letter-spacing: 8px; font-family: monospace;">${otpCode}</div>
            <span style="display: inline-block; margin-top: 8px; font-size: 12px; color: #dc2626; font-weight: 500;">⏱ Mã có hiệu lực trong vòng 5 phút</span>
          </div>

          <div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
              <strong style="color: #b45309;">Lưu ý bảo mật:</strong> Để đảm bảo an toàn tuyệt đối cho tài khoản và thú cưng của bạn, tuyệt đối không chia sẻ mã OTP này cho bất kỳ ai kể cả nhân viên phòng khám.
            </p>
          </div>

          <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email hoặc liên hệ tổng đài hỗ trợ <strong>1900-DRPETS</strong>.</p>
        </div>
        <div style="background-color: #f1f5f9; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
          <p style="margin: 0 0 4px;"><strong>Hệ thống Thú y & Bệnh viện Thú cưng Dr. Pet's House</strong></p>
          <p style="margin: 0; font-size: 11px; color: #94a3b8;">Email tự động từ hệ thống BrandName đa kênh DRPETSHOUSE. Vui lòng không trả lời thư này.</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false;
  }
};

export const sendGuestAccountEmail = async (toEmail, password, orderCode) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: getFromAddress('Pet Clinic'),
    to: toEmail,
    subject: 'Thông tin tài khoản và đơn hàng của bạn - Pet Clinic',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
        <h2 style="color: #333; text-align: center;">Đặt Hàng Thành Công</h2>
        <p>Chào bạn,</p>
        <p>Cảm ơn bạn đã mua sắm tại Pet Clinic. Đơn hàng của bạn với mã <strong>\${orderCode}</strong> đã được tạo thành công.</p>
        <p>Để giúp bạn dễ dàng theo dõi trạng thái đơn hàng và mua sắm trong tương lai, chúng tôi đã tự động tạo một tài khoản thành viên cho bạn với thông tin đăng nhập như sau:</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #eee;">
          <p style="margin: 5px 0;"><strong>Email đăng nhập:</strong> \${toEmail}</p>
          <p style="margin: 5px 0;"><strong>Mật khẩu:</strong> \${password}</p>
        </div>
        <p style="color: #ff9800;"><strong>* Lưu ý:</strong> Vui lòng đổi mật khẩu sau khi đăng nhập lần đầu tiên để đảm bảo bảo mật thông tin tài khoản.</p>
        <p>Nếu bạn có bất kỳ thắc mắc nào, vui lòng liên hệ với bộ phận hỗ trợ của chúng tôi.</p>
        <br>
        <p>Trân trọng,</p>
        <p><strong>Đội ngũ Pet Clinic</strong></p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending guest account email:', error);
    return false;
  }
};

export const sendAppointmentReminderEmail = async (toEmail, appointmentCode, date, time) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: getFromAddress('Pet Clinic'),
    to: toEmail,
    subject: `Nhắc nhở lịch hẹn sắp tới (Mã: ${appointmentCode}) - Pet Clinic`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
        <h2 style="color: #333; text-align: center;">Nhắc Nhở Lịch Hẹn</h2>
        <p>Chào bạn,</p>
        <p>Pet Clinic xin nhắc bạn có một lịch hẹn sắp tới với thông tin như sau:</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #eee;">
          <p style="margin: 5px 0;"><strong>Mã lịch hẹn:</strong> ${appointmentCode}</p>
          <p style="margin: 5px 0;"><strong>Ngày:</strong> ${date}</p>
          <p style="margin: 5px 0;"><strong>Thời gian:</strong> ${time}</p>
        </div>
        <p style="color: #ff9800;"><strong>* Lưu ý:</strong> Vui lòng có mặt đúng giờ để được phục vụ tốt nhất.</p>
        <p>Nếu bạn cần thay đổi lịch hẹn, vui lòng liên hệ với bộ phận hỗ trợ của chúng tôi.</p>
        <br>
        <p>Trân trọng,</p>
        <p><strong>Đội ngũ Pet Clinic</strong></p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending appointment reminder email:', error);
    return false;
  }
};

export const sendGuestOtpEmail = async (toEmail, otpCode) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: getFromAddress('Pet Clinic'),
    to: toEmail,
    subject: 'Mã xác thực tra cứu giao dịch - Pet Clinic',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
        <h2 style="color: #333; text-align: center;">Tra Cứu Giao Dịch</h2>
        <p>Chào bạn,</p>
        <p>Bạn đã yêu cầu mã xác nhận để tra cứu đơn hàng / lịch hẹn tại Pet Clinic. Vui lòng sử dụng mã OTP dưới đây:</p>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0; border: 1px dashed #ccc;">
          <h1 style="color: #2196f3; letter-spacing: 5px; margin: 0;">${otpCode}</h1>
        </div>
        <p>Mã này có hiệu lực trong vòng <strong>5 phút</strong>. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
        <br>
        <p>Trân trọng,</p>
        <p><strong>Đội ngũ Pet Clinic</strong></p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending guest OTP email:', error);
    return false;
  }
};

export const sendActivationInviteEmail = async (toEmail, inviteToken, fullName) => {
  const transporter = createTransporter();
  const customerAppUrl = process.env.CUSTOMER_APP_URL || 'https://drpetshouse.lat';
  const activationUrl = `${customerAppUrl}/activate?token=${inviteToken}`;

  const mailOptions = {
    from: getFromAddress('Pet Clinic'),
    to: toEmail,
    subject: 'Kích hoạt tài khoản thành viên - Pet Clinic',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
        <h2 style="color: #333; text-align: center;">Kích Hoạt Tài Khoản Pet Clinic</h2>
        <p>Chào ${fullName || 'bạn'},</p>
        <p>Cảm ơn bạn đã sử dụng dịch vụ tại Pet Clinic. Hãy kích hoạt tài khoản để liên kết toàn bộ đơn hàng và lịch hẹn của bạn:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${activationUrl}" style="background-color: #4caf50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Kích Hoạt Tài Khoản</a>
        </div>
        <p>Liên kết kích hoạt có hiệu lực trong vòng <strong>7 ngày</strong>.</p>
        <br>
        <p>Trân trọng,</p>
        <p><strong>Đội ngũ Pet Clinic</strong></p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending activation invite email:', error);
    return false;
  }
};

