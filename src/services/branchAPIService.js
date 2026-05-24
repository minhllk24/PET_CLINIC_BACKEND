import prisma from '../configs/prisma';

const getAllBranches = async () => {
  try {
    const branches = await prisma.branch.findMany({
      where: {
        status: 'active'
      },
      select: {
        branch_id: true,
        branch_name: true,
        address: true,
        phone: true,
        email: true
      }
    });

    // Convert BigInt to string for JSON serialization
    const serializedBranches = branches.map(b => ({
      ...b,
      branch_id: b.branch_id.toString()
    }));

    return { EM: 'Get branches successful', EC: 0, DT: serializedBranches };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

module.exports = {
  getAllBranches
};
