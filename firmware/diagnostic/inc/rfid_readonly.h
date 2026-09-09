#ifndef RFID_READONLY_H
#define RFID_READONLY_H
void RfidBegin(void);
void RfidArm(unsigned char step);
void RfidTick(void);
void RfidSafe(void);
unsigned char RfidState(void);
unsigned char RfidSnapshot(unsigned char page,unsigned char *p);
#endif
