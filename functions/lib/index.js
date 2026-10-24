/* eslint-disable */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
/**
 * updateUserPassword — callable Cloud Function
 * Allows an authenticated ADMIN to update any user's password.
 *
 * Request data: { uid: string, newPassword: string }
 * Returns: { success: true }
 */
exports.updateUserPassword = functions.https.onCall(async (data, context) => {
    var _a;
    // 1. Verify the caller is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
    }
    // 2. Verify the caller is an ADMIN by reading their Firestore role
    const callerDoc = await admin
        .firestore()
        .collection("users")
        .doc(context.auth.uid)
        .get();
    if (!callerDoc.exists || ((_a = callerDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== "ADMIN") {
        throw new functions.https.HttpsError("permission-denied", "Only admins can update passwords.");
    }
    // 3. Validate inputs
    const { uid, newPassword } = data;
    if (!uid || typeof uid !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "uid is required.");
    }
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
        throw new functions.https.HttpsError("invalid-argument", "Password must be at least 6 characters.");
    }
    // 4. Update the password using Firebase Admin SDK
    await admin.auth().updateUser(uid, { password: newPassword });
    return { success: true };
});
//# sourceMappingURL=index.js.map