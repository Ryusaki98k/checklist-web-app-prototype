function login(userID: string, branchID: string) {
    localStorage.setItem("user_id", userID)
    localStorage.setItem("branch_id", branchID)
}
function startSession(shift_session: string) {
    localStorage.setItem("shift_session", shift_session)
}
function endSession(shift_session: string) {
    localStorage.removeItem("shift_session")
}

function updateBranchLastUpdate(timestamp: Date) {
    localStorage.setItem("branch_last_update", timestamp.toString())
}
function getBranchLastUpdate(): Date | null {
    const data = localStorage.getItem("branch_last_update");

    return typeof (data) == "string" ? new Date(data) : null;
}
function shouldBranchUpdate(timestamp: Date): boolean {
    const last = getBranchLastUpdate();

    if (last instanceof Date) {
        return timestamp == last;
    }

    return true;
}

function clear() {
    localStorage.clear()
}