import nodemailer from 'nodemailer';
require('dotenv').config();

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_APP,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });
};

export const sendOtpEmail = async (toEmail, otpCode) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"Pet Clinic" <${process.env.EMAIL_APP}>`,
    to: toEmail,
    subject: 'Mã xác nhận khôi phục mật khẩu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
        <h2 style="color: #333; text-align: center;">Khôi Phục Mật Khẩu</h2>
        <p>Chào bạn,</p>
        <p>Bạn đã yêu cầu khôi phục mật khẩu cho tài khoản tại Pet Clinic. Vui lòng sử dụng mã OTP dưới đây để xác nhận:</p>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0; border: 1px dashed #ccc;">
          <h1 style="color: #ff9800; letter-spacing: 5px; margin: 0;">${otpCode}</h1>
        </div>
        <p>Mã này sẽ hết hạn sau <strong>5 phút</strong>. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
        <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
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
    console.error('Error sending OTP email:', error);
    return false;
  }
};

export const sendGuestAccountEmail = async (toEmail, password, orderCode) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"Pet Clinic" <${process.env.EMAIL_APP}>`,
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
    from: `"Pet Clinic" <${process.env.EMAIL_APP}>`,
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
    from: `"Pet Clinic" <${process.env.EMAIL_APP}>`,
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
    from: `"Pet Clinic" <${process.env.EMAIL_APP}>`,
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

