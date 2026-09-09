import jwt from 'jsonwebtoken'
import 'dotenv/config'

// STAFF
export const createStaffToken = async (staff) => {
  const payload = {
    id: staff.id,
    role: staff.role
  }

  const token = jwt.sign(payload, process.env.JWT_SECRET_KEY, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  })

  return token
}

export const verifyStaffToken = async (token) => {
  const payload = jwt.verify(token, process.env.JWT_SECRET_KEY, {
    algorithms: ['HS256']
  })

  return payload
}

// ADMIN_DEPT
export const createAdminDeptToken = async (adminDept) => {
  const payload = {
    id: adminDept.id,
    role: adminDept.role
  }

  const token = jwt.sign(payload, process.env.JWT_SECRET_KEY_ADMIN_DEPT, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  })

  return token
}

export const verifyAdminDeptToken = async (token) => {
  const payload = jwt.verify(token, process.env.JWT_SECRET_KEY_ADMIN_DEPT, {
    algorithms: ['HS256']
  })

  return payload
}

// ADMIN_SYSTEM
export const createAdminSystemToken = async (adminSystem) => {
  const payload = {
    id: adminSystem.id,
    role: adminSystem.role
  }

  const token = jwt.sign(payload, process.env.JWT_SECRET_KEY_ADMIN_SYSTEM, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  })

  return token
}

export const verifyAdminSystemToken = async (token) => {
  const payload = jwt.verify(token, process.env.JWT_SECRET_KEY_ADMIN_SYSTEM, {
    algorithms: ['HS256']
  })

  return payload
}

// Event QR
const getEventQrSecret = () => {
  if (!process.env.EVENT_QR_SECRET) {
    throw new Error('EVENT_QR_SECRET is required')
  }

  return process.env.EVENT_QR_SECRET
}

export const createEventQrToken = ({ eventId, userId, endTime }) =>
  jwt.sign(
    {
      type: 'EVENT_CHECKIN',
      eventId,
      userId,
      exp: Math.floor(new Date(endTime).getTime() / 1000) + 2 * 60 * 60
    },
    getEventQrSecret(),
    { algorithm: 'HS256' }
  )

export const verifyEventQrToken = (token) =>
  jwt.verify(token, getEventQrSecret(), { algorithms: ['HS256'] })
