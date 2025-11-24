import { Types } from "mongoose";
import RoleModel from "../models/roles-permission.model";
import UserModel from "../models/user.model";
import AccountModel from "../models/account.model";
import WorkspaceModel from "../models/workspace.model";
import MemberModel from "../models/member.model";
import { Roles } from "../enums/role.enum";
import { RolePermissions } from "../utils/role-permission";
import { ProviderEnum } from "../enums/account-provider.enum";

export const autoInjectRoles = async () => {
  try {
    console.log("Starting Auto Role + Super Admin Injection...");

    // 1. Create roles if missing
    for (const role of Object.values(Roles)) {
      const exists = await RoleModel.findOne({ name: role });
      if (!exists) {
        await RoleModel.create({ name: role, permissions: RolePermissions[role] });
        console.log(`Created role → ${role}`);
      } else {
        console.log(`Role OK → ${role}`);
      }
    }

    // 2. HARD-CODED SUPER ADMIN (for development only)
    const SUPER_EMAIL = "admin@devconsoftware.com";
    const SUPER_PASS  = "Admin@123";           // ← THIS IS YOUR PASSWORD
    const SUPER_NAME  = "System Admin";

    const adminExists = await UserModel.findOne({ email: SUPER_EMAIL });

    if (!adminExists) {
      const user = await UserModel.create({
        email: SUPER_EMAIL,
        name: SUPER_NAME,
        password: SUPER_PASS,        // pre-save hook will hash it
      });

      await AccountModel.create({
        userId: user._id,
        provider: ProviderEnum.EMAIL,
        providerId: SUPER_EMAIL,
      });

      const workspace = await WorkspaceModel.create({
        name: "DevCon Main Workspace",
        description: "Auto-created for super admin",
        owner: user._id,
        // inviteCode: nanoid(10),   // ← This generates real invite code like "X7kP9mN2vQ"
      });

      // ✅ Add null check for ownerRole
      const ownerRole = await RoleModel.findOne({ name: Roles.OWNER });
      if (!ownerRole) {
        throw new Error("OWNER role not found. Role creation may have failed.");
      }

      await MemberModel.create({
        userId: user._id,
        workspaceId: workspace._id,
        role: ownerRole._id,  // ✅ No non-null assertion needed
        joinedAt: new Date(),
      });

      // ✅ Proper type casting for currentWorkspace
       // ✅ Proper type casting for currentWorkspace
      user.currentWorkspace = workspace._id as Types.ObjectId;
      await user.save();

      console.log("SUPER ADMIN CREATED");
      console.log("Email   → admin@devconsoftware.com");
      console.log("Password → admin123");
    } else {
      console.log("Super admin already exists");
    }

    console.log("AUTO INJECTION COMPLETED SUCCESSFULLY");
  } catch (err) {
    console.error("autoInjectRoles ERROR:", err);
    throw err;  // ✅ Re-throw to prevent silent failures
  }
};