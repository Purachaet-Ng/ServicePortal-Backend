import createHttpError from "http-errors";
import {
  createUser,
  findAllUsers,
  findPublicUserById,
  findUserByEmail,
  updateUserById,
  deleteUserById
} from "../services/users.service.js";
import bcrypt from "bcrypt";

export async function listUsers(req, res, next) {
  try {
    const allUsers = await findAllUsers();

    return res.status(200).json({
      users: allUsers,
    });
  } catch (error) {
    next(error);
  }
}

export async function getUser(req, res, next) {
  try {
    const userId = req.valid.params.id;
    const foundUser = await findPublicUserById(userId);

    if (!foundUser) {
      throw createHttpError(404, "User not found");
    }

    return res.status(200).json({
      user: foundUser,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req, res, next) {
  try {
    const userId = req.valid.params.id;
    const userFieldsToUpdate = req.valid.body;
    const userToUpdate = await findPublicUserById(userId);

    if (!userToUpdate) {
      throw createHttpError(404, "User not found");
    }

    const updatedUser = await updateUserById(userId, userFieldsToUpdate);

    return res.status(200).json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateUserRole(req, res, next) {
  try {
    const userId = req.valid.params.id;
    const newRole = req.valid.body.role;
    const userToUpdate = await findPublicUserById(userId);

    if (!userToUpdate) {
      throw createHttpError(404, "User not found");
    }

    const updatedUser = await updateUserById(userId, {
      role: newRole,
    });

    return res.status(200).json({
      message: "User role updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
}

export async function createUserByAdmin(req, res, next) {
  try {
    const newUserData = req.body;
    const userWithSameEmail = await findUserByEmail(newUserData.email);

    if (userWithSameEmail) {
      throw createHttpError(409, "Email already exists");
    }

    const passwordHash = await bcrypt.hash(newUserData.password, 12);

    const createdUser = await createUser({
      firstname: newUserData.firstname,
      lastname: newUserData.lastname,
      phone: newUserData.phone,
      email: newUserData.email,
      passwordHash,
      departmentId: newUserData.departmentId,
      role: newUserData.role,
    });

    return res.status(201).json({
      message: "User created successfully",
      user: createdUser,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const userId = req.valid.params.id;
    const userToDelete = await findPublicUserById(userId);

    if (!userToDelete) {
      throw createHttpError(404, "User not found");
    }

    const deletedUser = await deleteUserById(userId);

    return res.status(200).json({
      message: "User deleted successfully",
      user: deletedUser,
    });
  } catch (error) {
    next(error);
  }
}