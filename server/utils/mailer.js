import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for port 465
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const otpHtml = (title, body, otp) => `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem;">
        <h2 style="margin-bottom: 0.5rem;">${title}</h2>
        <p style="color: #555;">${body}</p>
        <div style="font-size: 2.5rem; font-weight: bold; letter-spacing: 0.75rem;
                    text-align: center; padding: 1.5rem; background: #f4f4f4;
                    border-radius: 8px; margin: 1.5rem 0; color: #000;">
            ${otp}
        </div>
        <p style="color: #555; font-size: 0.9rem;">This code expires in <strong>10 minutes</strong>.</p>
        <p style="color: #999; font-size: 0.85rem;">If you didn't request this, ignore this email.</p>
        <hr style="margin: 2rem 0; border: none; border-top: 1px solid #eee;" />
        <p style="color: #aaa; font-size: 0.8rem;">Gorur Gari — Your trusted fashion store</p>
    </div>
`;

const from = () => `"Gorur Gari" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;

export const sendOtpEmail = async (email, otp, name) => {
    await transporter.sendMail({
        from: from(),
        to: email,
        subject: 'Your Gorur Gari verification code',
        html: otpHtml(`Hi ${name},`, 'Use the code below to verify your email address.', otp),
    });
};

export const sendPasswordResetEmail = async (email, otp, name) => {
    await transporter.sendMail({
        from: from(),
        to: email,
        subject: 'Reset your Gorur Gari password',
        html: otpHtml(`Hi ${name},`, 'Use the code below to reset your password.', otp),
    });
};
