import prisma from '../configs/prisma';

const createContactMessage = async (data) => {
  try {
    if (!data.name || !data.phone || !data.email || !data.message) {
      return { EM: 'Missing required fields', EC: 1, DT: '' };
    }

    const newMessage = await prisma.contactMessage.create({
      data: {
        name: data.name,
        gender: data.gender || null,
        phone: data.phone,
        email: data.email,
        message: data.message,
        status: 'unread'
      }
    });

    return { EM: 'Message created successfully', EC: 0, DT: newMessage };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getContactMessages = async () => {
  try {
    const messages = await prisma.contactMessage.findMany({
      orderBy: { created_at: 'desc' }
    });
    return { EM: 'Get messages successfully', EC: 0, DT: messages };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

module.exports = {
  createContactMessage,
  getContactMessages
};
