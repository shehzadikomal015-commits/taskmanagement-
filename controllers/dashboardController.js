import { getDashboardStats } from "../models/taskModel.js";

export const getDashboard = async (req, res, next) => {
  try {
    const stats = await getDashboardStats(req.user.id);

    res.status(200).json({
      message: "Dashboard statistics retrieved successfully",
      stats
    });
  } catch (error) {
    next(error);
  }
};