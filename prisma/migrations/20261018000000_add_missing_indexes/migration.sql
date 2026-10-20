-- CreateIndex
CREATE INDEX "Group_centerId_idx" ON "Group"("centerId");

-- CreateIndex
CREATE INDEX "Group_assistantMembershipId_idx" ON "Group"("assistantMembershipId");

-- CreateIndex
CREATE INDEX "SupportTicket_centerId_idx" ON "SupportTicket"("centerId");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_idx" ON "TicketMessage"("ticketId");

-- CreateIndex
CREATE INDEX "PendingInvite_inviteCodeId_idx" ON "PendingInvite"("inviteCodeId");
