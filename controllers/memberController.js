const Admin = require('../models/admin.model');
const Manager = require('../models/manager.model');
const Employee = require('../models/employee.model');
const Citizen = require('../models/citizen.model');

// Get all members from all roles (super-admin to citizens)
exports.getAllMembers = async (req, res) => {
  try {
    console.log('Fetching all members from all roles...');

    // Fetch all users from different collections
    const [admins, managers, employees, citizens] = await Promise.all([
      Admin.find({}).select('-password').lean(),
      Manager.find({}).select('-password').lean(),
      Employee.find({}).select('-password').lean(),
      Citizen.find({}).select('-password').lean()
    ]);

    // Process and standardize the data
    const processedAdmins = admins.map(admin => ({
      _id: admin._id,
      username: admin.username,
      name: admin.name || 'N/A',
      email: admin.email,
      phone: admin.phone || 'N/A',
      role: admin.adminType === 'super-admin' ? 'super-admin' : 'admin',
      roleLevel: admin.adminType === 'super-admin' ? 4 : 3,
      department: 'Administration',
      employeeId: null,
      address: null,
      isApproved: true,
      approvedBy: null,
      approvedAt: null,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt
    }));

    const processedManagers = managers.map(manager => ({
      _id: manager._id,
      username: manager.username,
      name: manager.name || 'N/A',
      email: manager.email,
      phone: manager.phone || 'N/A',
      role: 'manager',
      roleLevel: 2,
      department: manager.department || 'N/A',
      employeeId: null,
      address: null,
      isApproved: manager.isApproved || false,
      approvedBy: manager.approvedBy,
      approvedAt: manager.approvedAt,
      createdAt: manager.createdAt || manager.createdAt,
      updatedAt: manager.updatedAt || manager.updatedAt
    }));

    const processedEmployees = employees.map(employee => ({
      _id: employee._id,
      username: employee.username,
      name: employee.name || 'N/A',
      email: employee.email,
      phone: employee.phone || 'N/A',
      role: 'employee',
      roleLevel: 1,
      department: employee.department || 'N/A',
      employeeId: employee.employeeId || 'N/A',
      address: null,
      isApproved: true,
      approvedBy: null,
      approvedAt: null,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt
    }));

    const processedCitizens = citizens.map(citizen => ({
      _id: citizen._id,
      username: citizen.username,
      name: citizen.name || 'N/A',
      email: citizen.email,
      phone: citizen.phone || 'N/A',
      role: 'citizen',
      roleLevel: 1,
      department: 'Public',
      employeeId: null,
      address: citizen.address || 'N/A',
      isApproved: true,
      approvedBy: null,
      approvedAt: null,
      createdAt: citizen.createdAt,
      updatedAt: citizen.updatedAt
    }));

    // Combine all members
    const allMembers = [
      ...processedAdmins,
      ...processedManagers,
      ...processedEmployees,
      ...processedCitizens
    ];

    // Sort by role level (highest first) then by creation date
    allMembers.sort((a, b) => {
      if (a.roleLevel !== b.roleLevel) {
        return b.roleLevel - a.roleLevel; // Higher role level first
      }
      return new Date(b.createdAt) - new Date(a.createdAt); // Newer first
    });

    // Generate summary statistics
    const summary = {
      total: allMembers.length,
      superAdmins: processedAdmins.filter(a => a.role === 'super-admin').length,
      admins: processedAdmins.filter(a => a.role === 'admin').length,
      managers: processedManagers.length,
      employees: processedEmployees.length,
      citizens: processedCitizens.length,
      pendingApprovals: processedManagers.filter(m => !m.isApproved).length
    };

    console.log(`✅ Successfully fetched ${allMembers.length} members`);
    console.log('Summary:', summary);

    res.json({
      success: true,
      message: 'All members fetched successfully',
      data: {
        members: allMembers,
        summary: summary,
        roleHierarchy: [
          { role: 'super-admin', level: 4, count: summary.superAdmins },
          { role: 'admin', level: 3, count: summary.admins },
          { role: 'manager', level: 2, count: summary.managers },
          { role: 'employee', level: 1, count: summary.employees },
          { role: 'citizen', level: 1, count: summary.citizens }
        ]
      }
    });

  } catch (error) {
    console.error('Error fetching all members:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch members',
      error: error.message
    });
  }
};

// Get members by specific role
exports.getMembersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    console.log(`Fetching members with role: ${role}`);

    let members = [];
    let Model = null;

    switch (role.toLowerCase()) {
      case 'super-admin':
        members = await Admin.find({ adminType: 'super-admin' }).select('-password').lean();
        break;
      case 'admin':
        members = await Admin.find({ $or: [{ adminType: 'admin' }, { adminType: { $exists: false } }] }).select('-password').lean();
        break;
      case 'manager':
        members = await Manager.find({}).select('-password').lean();
        break;
      case 'employee':
        members = await Employee.find({}).select('-password').lean();
        break;
      case 'citizen':
        members = await Citizen.find({}).select('-password').lean();
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Valid roles: super-admin, admin, manager, employee, citizen'
        });
    }

    res.json({
      success: true,
      message: `${role} members fetched successfully`,
      data: {
        role: role,
        count: members.length,
        members: members
      }
    });

  } catch (error) {
    console.error(`Error fetching ${role} members:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to fetch ${role} members`,
      error: error.message
    });
  }
};

// Get member statistics
exports.getMemberStats = async (req, res) => {
  try {
    console.log('Fetching member statistics...');

    const [adminCount, managerCount, employeeCount, citizenCount] = await Promise.all([
      Admin.countDocuments({}),
      Manager.countDocuments({}),
      Employee.countDocuments({}),
      Citizen.countDocuments({})
    ]);

    const [superAdminCount, regularAdminCount, pendingManagerCount] = await Promise.all([
      Admin.countDocuments({ adminType: 'super-admin' }),
      Admin.countDocuments({ $or: [{ adminType: 'admin' }, { adminType: { $exists: false } }] }),
      Manager.countDocuments({ isApproved: false })
    ]);

    const stats = {
      total: adminCount + managerCount + employeeCount + citizenCount,
      byRole: {
        superAdmin: superAdminCount,
        admin: regularAdminCount,
        manager: managerCount,
        employee: employeeCount,
        citizen: citizenCount
      },
      pending: {
        managers: pendingManagerCount
      },
      hierarchy: [
        { role: 'super-admin', level: 4, count: superAdminCount },
        { role: 'admin', level: 3, count: regularAdminCount },
        { role: 'manager', level: 2, count: managerCount },
        { role: 'employee', level: 1, count: employeeCount },
        { role: 'citizen', level: 1, count: citizenCount }
      ]
    };

    console.log('✅ Member statistics generated:', stats);

    res.json({
      success: true,
      message: 'Member statistics fetched successfully',
      data: stats
    });

  } catch (error) {
    console.error('Error fetching member statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch member statistics',
      error: error.message
    });
  }
};

// Create new member (role-based)
exports.createMember = async (req, res) => {
  try {
    const { role, ...memberData } = req.body;
    
    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Role is required'
      });
    }

    console.log(`Creating new ${role} member:`, memberData);

    let newMember;
    let Model;

    switch (role.toLowerCase()) {
      case 'super-admin':
        Model = Admin;
        newMember = new Model({
          ...memberData,
          role: 'admin',
          adminType: 'super-admin'
        });
        break;
        
      case 'admin':
        Model = Admin;
        newMember = new Model({
          ...memberData,
          role: 'admin',
          adminType: 'admin'
        });
        break;
        
      case 'manager':
        Model = Manager;
        newMember = new Model({
          ...memberData,
          role: 'manager',
          isApproved: false // Managers need approval
        });
        break;
        
      case 'employee':
        Model = Employee;
        newMember = new Model({
          ...memberData,
          role: 'employee'
        });
        break;
        
      case 'citizen':
        Model = Citizen;
        newMember = new Model({
          ...memberData,
          role: 'citizen'
        });
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Valid roles: super-admin, admin, manager, employee, citizen'
        });
    }

    const savedMember = await newMember.save();
    
    // Remove password from response
    const responseMember = savedMember.toObject();
    delete responseMember.password;

    console.log(`✅ ${role} member created successfully with ID: ${savedMember._id}`);

    res.status(201).json({
      success: true,
      message: `${role} member created successfully`,
      data: {
        member: responseMember,
        role: role,
        id: savedMember._id
      }
    });

  } catch (error) {
    console.error('Error creating member:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`,
        error: `Duplicate ${field}: ${error.keyValue[field]}`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create member',
      error: error.message
    });
  }
};

// Delete member (role-based)
exports.deleteMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.query; // Get role from query parameter
    
    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Role query parameter is required'
      });
    }

    console.log(`Deleting ${role} member with ID: ${id}`);

    let Model;
    let deletedMember;

    switch (role.toLowerCase()) {
      case 'super-admin':
      case 'admin':
        Model = Admin;
        deletedMember = await Model.findByIdAndDelete(id);
        break;
        
      case 'manager':
        Model = Manager;
        deletedMember = await Model.findByIdAndDelete(id);
        break;
        
      case 'employee':
        Model = Employee;
        deletedMember = await Model.findByIdAndDelete(id);
        break;
        
      case 'citizen':
        Model = Citizen;
        deletedMember = await Model.findByIdAndDelete(id);
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Valid roles: super-admin, admin, manager, employee, citizen'
        });
    }

    if (!deletedMember) {
      return res.status(404).json({
        success: false,
        message: `${role} member not found`
      });
    }

    console.log(`✅ ${role} member deleted successfully: ${deletedMember.username}`);

    res.json({
      success: true,
      message: `${role} member deleted successfully`,
      data: {
        deletedMember: {
          id: deletedMember._id,
          username: deletedMember.username,
          name: deletedMember.name,
          role: role
        }
      }
    });

  } catch (error) {
    console.error('Error deleting member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete member',
      error: error.message
    });
  }
};

// Update member (role-based)
exports.updateMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, ...updateData } = req.body;
    
    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Role is required in request body'
      });
    }

    console.log(`Updating ${role} member with ID: ${id}`, updateData);

    let Model;
    let updatedMember;

    switch (role.toLowerCase()) {
      case 'super-admin':
      case 'admin':
        Model = Admin;
        updatedMember = await Model.findByIdAndUpdate(
          id, 
          updateData, 
          { new: true, runValidators: true }
        ).select('-password');
        break;
        
      case 'manager':
        Model = Manager;
        updatedMember = await Model.findByIdAndUpdate(
          id, 
          updateData, 
          { new: true, runValidators: true }
        ).select('-password');
        break;
        
      case 'employee':
        Model = Employee;
        updatedMember = await Model.findByIdAndUpdate(
          id, 
          updateData, 
          { new: true, runValidators: true }
        ).select('-password');
        break;
        
      case 'citizen':
        Model = Citizen;
        updatedMember = await Model.findByIdAndUpdate(
          id, 
          updateData, 
          { new: true, runValidators: true }
        ).select('-password');
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Valid roles: super-admin, admin, manager, employee, citizen'
        });
    }

    if (!updatedMember) {
      return res.status(404).json({
        success: false,
        message: `${role} member not found`
      });
    }

    console.log(`✅ ${role} member updated successfully: ${updatedMember.username}`);

    res.json({
      success: true,
      message: `${role} member updated successfully`,
      data: {
        member: updatedMember,
        role: role
      }
    });

  } catch (error) {
    console.error('Error updating member:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`,
        error: `Duplicate ${field}: ${error.keyValue[field]}`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update member',
      error: error.message
    });
  }
};
