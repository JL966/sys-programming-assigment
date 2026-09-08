#ifndef ACCEPTANCE_PROTOCOL_H
#define ACCEPTANCE_PROTOCOL_H

#define PROTO_FRAME_SIZE 24u
#define PROTO_PAYLOAD_SIZE 8u
#define PROTO_VERSION 1u

#define PROTO_FLAG_RESPONSE 0x01u
#define PROTO_FLAG_ERROR 0x02u

#define PROTO_NODE_PC 0u
#define PROTO_NODE_CTRL 1u
#define PROTO_NODE_DUT 2u
#define PROTO_NODE_REF 3u
#define PROTO_NODE_BROADCAST 0xFFu

#define PROTO_MSG_HELLO 0x01u
#define PROTO_MSG_GET_STATUS 0x02u
#define PROTO_MSG_BEGIN_SESSION 0x03u
#define PROTO_MSG_CLOSE_SESSION 0x04u
#define PROTO_MSG_CONFIG_WRITE 0x05u
#define PROTO_MSG_CONFIG_COMMIT 0x06u
#define PROTO_MSG_RUN_PLAN 0x07u
#define PROTO_MSG_PAUSE_PLAN 0x08u
#define PROTO_MSG_RESUME_PLAN 0x09u
#define PROTO_MSG_PREPARE_TEST 0x10u
#define PROTO_MSG_EXECUTE_STEP 0x11u
#define PROTO_MSG_READ_RECORD 0x12u
#define PROTO_MSG_CANCEL_TEST 0x13u
#define PROTO_MSG_HUMAN_CONFIRM 0x14u
#define PROTO_MSG_RELEASE_RESULT 0x15u
#define PROTO_MSG_RENEW_LEASE 0x16u
#define PROTO_MSG_LINK_CHALLENGE 0x20u
#define PROTO_MSG_TX_LEASE 0x21u
#define PROTO_MSG_SNAPSHOT_ACK 0x30u

typedef enum ProtoResultTag {
    PROTO_OK = 0,
    PROTO_ERR_SOF,
    PROTO_ERR_CRC,
    PROTO_ERR_VERSION,
    PROTO_ERR_LENGTH,
    PROTO_ERR_FLAGS,
    PROTO_ERR_ADDRESS,
    PROTO_ERR_SESSION,
    PROTO_ERR_ARGUMENT
} ProtoResult;

typedef struct ProtoFrameTag {
    unsigned char version;
    unsigned char msg_type;
    unsigned char src;
    unsigned char dst;
    unsigned short session;
    unsigned short seq;
    unsigned char test_id;
    unsigned char step;
    unsigned char payload_len;
    unsigned char flags;
    unsigned char payload[PROTO_PAYLOAD_SIZE];
} ProtoFrame;

unsigned short Proto_Crc16(const unsigned char *bytes, unsigned short length);
ProtoResult Proto_Encode(const ProtoFrame *frame, unsigned char out[PROTO_FRAME_SIZE]);
ProtoResult Proto_Decode(const unsigned char wire[PROTO_FRAME_SIZE],
                         unsigned char destination,
                         unsigned short expected_session,
                         ProtoFrame *out);

#endif
