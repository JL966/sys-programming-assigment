#ifndef DIAG_EXTENSION_H
#define DIAG_EXTENSION_H
void ExtensionSafe(void);
void ExtensionPrepare(unsigned char id);
unsigned char ExtensionStart(unsigned char step, unsigned char *p);
void ExtensionTick(void);
unsigned char ExtensionSnapshot(unsigned char page,unsigned char *p);
#endif
